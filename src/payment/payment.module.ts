import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [TransactionsModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}

