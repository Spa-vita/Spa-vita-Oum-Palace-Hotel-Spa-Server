import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  generateCmiHash,
  redactCmiParamsForLog,
  toStringParams,
} from './cmi-hash.util';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

export interface CmiInitiateResponse {
  paymentUrl: string;
  fields: Record<string, string>;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  initiate(dto: InitiatePaymentDto): CmiInitiateResponse {
    const storeKey = this.requireStoreKey();
    const clientId = this.config.get<string>('CMI_CLIENT_ID')?.trim() ?? '7700147718';
    const paymentUrl =
      this.config.get<string>('CMI_PAYMENT_URL')?.trim() ??
      'https://testpayment.cmi.co.ma/fim/est3Dgate';
    const okUrl = this.resolveUrl(
      'CMI_OK_URL',
      'http://localhost:3001/payments/cmi/success',
    );
    const failUrl = this.resolveUrl(
      'CMI_FAIL_URL',
      'http://localhost:3001/payments/cmi/fail',
    );
    const callbackUrl = this.resolveUrl(
      'CMI_CALLBACK_URL',
      'http://localhost:3001/payments/cmi/callback',
    );

    const amount = dto.amount.toFixed(2);
    const billToName = dto.roomType.replace(/\s+/g, ' ').trim().slice(0, 64);

    const fields: Record<string, string> = {
      clientid: clientId,
      storetype: '3D_PAY_HOSTING',
      TranType: 'PreAuth',
      amount,
      currency: '504',
      oid: dto.orderId,
      okUrl,
      failUrl,
      callbackURL: callbackUrl,
      email: dto.customerEmail,
      BillToName: billToName || 'Guest',
      rnd: Date.now().toString(),
      lang: 'fr',
      hashAlgorithm: 'ver3',
      encoding: 'UTF-8',
      refreshtime: '5',
      storekey: storeKey,
    };

    fields.HASH = generateCmiHash(fields, storeKey);
    delete fields.storekey;

    this.logger.log(`initiate() — oid=${dto.orderId} amount=${amount}`);

    return { paymentUrl, fields };
  }
  
  async handleCallback(body: Record<string, unknown>): Promise<string> {
    const params = toStringParams(body);
    const oid = params.oid ?? params.OID ?? '';

    this.logger.debug(
      `callback() params: ${JSON.stringify(redactCmiParamsForLog(params))}`,
    );

    this.assertValidCmiHash(params);

    const procReturn = params.ProcReturnCode ?? params.procReturnCode ?? '';
    const response = params.Response ?? params.response ?? '';

    if (procReturn !== '00' && response.toLowerCase() !== 'approved') {
      this.logger.warn(
        `callback() — payment not approved oid=${oid} ProcReturnCode=${procReturn}`,
      );
      return 'APPROVED';
    }

    if (oid) {
      await this.markReservationPaid(oid);
    }

    this.logger.log(`callback() OK — oid=${oid} status=paid`);
    return 'ACTION=POSTAUTH';
  }

  /** Validates CMI signature on browser return (success). */
  assertValidSuccessReturn(
    params: Record<string, string>,
    method: string,
  ): void {
    const oid = params.oid ?? params.OID ?? '';
    this.logger.debug(
      `success return (${method}) params: ${JSON.stringify(redactCmiParamsForLog(params))}`,
    );

    if (method === 'POST' || params.HASH) {
      this.assertValidCmiHash(params);
      return;
    }

    this.logger.debug(`success return (GET) — no HASH, oid=${oid}`);
  }

  getFrontendRedirect(path: 'success' | 'fail', query: Record<string, string>): string {
    const base =
      this.config.get<string>('FRONTEND_ORIGIN')?.split(',')[0]?.trim() ??
      'http://localhost:3000';
    const safe = this.sanitizeRedirectParams(query);
    const qs = new URLSearchParams(safe).toString();
    const suffix = qs ? `?${qs}` : '';
    return `${base.replace(/\/$/, '')}/payment/${path}${suffix}`;
  }

  /** Only non-sensitive fields are forwarded to the frontend redirect URL. */
  private sanitizeRedirectParams(
    params: Record<string, string>,
  ): Record<string, string> {
    const oid = params.oid ?? params.OID;
    const procReturn = params.ProcReturnCode ?? params.procReturnCode;
    const amount = params.amount ?? params.Amount;
    const transId = params.TransId ?? params.transId ?? params.transid;
    const safe: Record<string, string> = {};
    if (oid) {
      safe.oid = oid;
    }
    if (procReturn) {
      safe.ProcReturnCode = procReturn;
    }
    if (amount) {
      safe.amount = amount;
    }
    if (transId) {
      safe.TransId = transId;
    }
    return safe;
  }

  private assertValidCmiHash(params: Record<string, string>): void {
    const storeKey = this.requireStoreKey();
    const oid = params.oid ?? params.OID ?? '';
    const received = params.HASH ?? '';
    const computed = generateCmiHash(params, storeKey);

    if (computed !== received) {
      const sortedKeys = Object.keys(params)
        .filter((k) => k !== 'HASH' && k !== 'encoding')
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      this.logger.debug(
        `CMI hash mismatch — oid=${oid} sortedKeys=[${sortedKeys.join(', ')}] computed=${computed} received=${received}`,
      );
      this.logger.warn(`invalid CMI signature — oid=${oid}`);
      throw new BadRequestException('Invalid payment signature');
    }
  }

  private requireStoreKey(): string {
    const key = this.config.get<string>('CMI_STORE_KEY')?.trim();
    if (!key) {
      throw new BadRequestException('Payment gateway is not configured');
    }
    return key;
  }

  private resolveUrl(envKey: string, fallback: string): string {
    return this.config.get<string>(envKey)?.trim() || fallback;
  }

  private async markReservationPaid(orderId: string): Promise<void> {
    const client = this.supabase.getClient();

    const byId = await client
      .from('reservations')
      .update({ status: 'paid' } as never)
      .eq('id', orderId)
      .select('id')
      .maybeSingle();

    if (!byId.error && byId.data) {
      return;
    }

    const byRef = await client
      .from('reservations')
      .update({ status: 'paid' } as never)
      .eq('reference', orderId)
      .select('id')
      .maybeSingle();

    if (byRef.error) {
      this.logger.error(
        `markReservationPaid() — Supabase error: ${byRef.error.message}`,
      );
      throw new InternalServerErrorException(byRef.error.message);
    }

    if (!byRef.data) {
      this.logger.warn(`markReservationPaid() — reservation not found oid=${orderId}`);
    }
  }
}
