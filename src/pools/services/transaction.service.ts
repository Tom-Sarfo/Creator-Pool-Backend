import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Transaction, TransactionType, TransactionStatus } from "../../entities/transaction.entity";

export interface TransactionFilters {
  userId?: string;
  poolId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  page?: number;
  limit?: number;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>
  ) {}

  /**
   * Create a transaction record
   */
  async createTransaction(data: {
    userId: string;
    poolId?: string;
    type: TransactionType;
    amount: number;
    status?: TransactionStatus;
    description?: string;
    reference?: string;
  }): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      userId: data.userId,
      poolId: data.poolId,
      type: data.type,
      amount: data.amount,
      status: data.status || TransactionStatus.COMPLETED,
      description: data.description,
      reference: data.reference,
    });

    return await this.transactionRepository.save(transaction);
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(
    userId: string,
    filters: TransactionFilters = {}
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { type, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder("transaction")
      .where("transaction.userId = :userId", { userId })
      .leftJoinAndSelect("transaction.pool", "pool")
      .orderBy("transaction.createdAt", "DESC");

    if (type) {
      queryBuilder.andWhere("transaction.type = :type", { type });
    }

    if (status) {
      queryBuilder.andWhere("transaction.status = :status", { status });
    }

    const [transactions, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      transactions,
      total,
      page,
      limit,
    };
  }

  /**
   * Get all transactions for a pool
   */
  async getPoolTransactions(poolId: string): Promise<Transaction[]> {
    return await this.transactionRepository.find({
      where: { poolId },
      relations: ["user"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ["user", "pool"],
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    return transaction;
  }
}


