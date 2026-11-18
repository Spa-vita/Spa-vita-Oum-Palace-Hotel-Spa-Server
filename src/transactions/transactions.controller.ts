import {
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransactionsService } from './transactions.service';

@Controller('admin/transactions')
@UseGuards(AuthGuard('jwt-admin'))
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  async list(
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
  ) {
    this.logger.log(`GET /admin/transactions — limit=${limit}`);
    const items = await this.transactions.list(limit);
    return { items };
  }
}
