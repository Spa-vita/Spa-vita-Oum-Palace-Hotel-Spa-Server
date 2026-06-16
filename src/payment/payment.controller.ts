import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentService } from './payment.service';

@Controller('payments/cmi')
@UseGuards(ThrottlerGuard)
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly payment: PaymentService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  initiate(@Body() dto: InitiatePaymentDto) {
    this.logger.debug(`initiate() — oid=${dto.orderId}`);
    this.logger.log(`POST /payments/cmi/initiate — body: ${JSON.stringify(dto)}`);
    this.logger.log(`POST /payments/cmi/initiate — orderId=${dto.orderId}`);
    return this.payment.initiate(dto);
  }

  /** CMI server-to-server callback (form-urlencoded) */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async callback(@Req() req: Request): Promise<string> {
    this.logger.log('POST /payments/cmi/callback — CMI notification received');
    const body = (req.body ?? {}) as Record<string, unknown>;
    return this.payment.handleCallback(body);
  }

  @Get('success')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  successGet(
    @Req() req: Request,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): void {
    this.handleReturn('success', req, query, res);
  }

  @Post('success')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  successPost(
    @Req() req: Request,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): void {
    this.handleReturn('success', req, query, res);
  }

  @Get('fail')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  failGet(
    @Req() req: Request,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): void {
    this.handleReturn('fail', req, query, res);
  }

  @Post('fail')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  failPost(
    @Req() req: Request,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): void {
    this.handleReturn('fail', req, query, res);
  }

  private handleReturn(
    path: 'success' | 'fail',
    req: Request,
    query: Record<string, string>,
    res: Response,
  ): void {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const params: Record<string, string> = { ...query };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null && params[key] === undefined) {
        params[key] = String(value);
      }
    }

    if (path === 'success') {
      this.payment.assertValidSuccessReturn(params, req.method);
    } else {
      this.logger.debug(
        `${req.method} /payments/cmi/fail — oid=${params.oid ?? params.OID ?? 'unknown'}`,
      );
    }

    this.logger.log(
      `${req.method} /payments/cmi/${path} — redirecting to frontend`,
    );

    const url = this.payment.getFrontendRedirect(path, params);
    res.redirect(url);
  }
}
