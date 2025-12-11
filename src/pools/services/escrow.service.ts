import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Pool } from "../../entities/pool.entity";
import { User } from "../../entities/user.entity";
import { Transaction, TransactionType, TransactionStatus } from "../../entities/transaction.entity";

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectDataSource()
    private dataSource: DataSource
  ) {}

  /**
   * Deposit funds from user wallet to pool escrow
   */
  async depositToEscrow(
    poolId: string,
    userId: string,
    amount: number,
    type: TransactionType.PLEDGE | TransactionType.STAKE
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get pool and user
      const pool = await queryRunner.manager.findOne(Pool, {
        where: { id: poolId },
      });
      if (!pool) {
        throw new NotFoundException("Pool not found");
      }

      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }

      // Validate user has sufficient balance
      const walletBalance = Number(user.walletBalance) || 0;
      if (amount > walletBalance) {
        throw new Error("Insufficient wallet balance");
      }

      // Deduct from user wallet
      user.walletBalance = walletBalance - amount;
      await queryRunner.manager.save(user);

      // Add to pool escrow
      if (type === TransactionType.PLEDGE) {
        pool.escrowedCreatorPledge =
          Number(pool.escrowedCreatorPledge) + amount;
      } else {
        pool.escrowedPredictorStakes =
          Number(pool.escrowedPredictorStakes) + amount;
      }
      pool.escrowedAmount = Number(pool.escrowedAmount) + amount;
      await queryRunner.manager.save(pool);

      // Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        userId,
        poolId,
        type,
        amount,
        status: TransactionStatus.COMPLETED,
        description: `Deposited ${amount} to escrow for pool ${poolId}`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Deposited ${amount} to escrow for pool ${poolId} by user ${userId}`
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error depositing to escrow for pool ${poolId}:`,
        error
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Release funds from escrow to user wallet
   */
  async releaseFromEscrow(
    poolId: string,
    userId: string,
    amount: number,
    type: TransactionType.WINNINGS | TransactionType.ROYALTY | TransactionType.REFUND
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get pool and user
      const pool = await queryRunner.manager.findOne(Pool, {
        where: { id: poolId },
      });
      if (!pool) {
        throw new NotFoundException("Pool not found");
      }

      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }

      // Validate escrow has sufficient funds
      const escrowedAmount = Number(pool.escrowedAmount) || 0;
      if (amount > escrowedAmount) {
        throw new Error("Insufficient escrow balance");
      }

      // Add to user wallet
      user.walletBalance = Number(user.walletBalance) + amount;
      await queryRunner.manager.save(user);

      // Deduct from pool escrow
      pool.escrowedAmount = escrowedAmount - amount;
      await queryRunner.manager.save(pool);

      // Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        userId,
        poolId,
        type,
        amount,
        status: TransactionStatus.COMPLETED,
        description: `Released ${amount} from escrow for pool ${poolId}`,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Released ${amount} from escrow for pool ${poolId} to user ${userId}`
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error releasing from escrow for pool ${poolId}:`,
        error
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get total escrowed amount for a pool
   */
  async getEscrowBalance(poolId: string): Promise<number> {
    const pool = await this.poolRepository.findOne({
      where: { id: poolId },
    });

    if (!pool) {
      throw new NotFoundException("Pool not found");
    }

    return Number(pool.escrowedAmount) || 0;
  }

  /**
   * Validate escrow integrity - verify escrow matches pool stakes
   */
  async validateEscrowIntegrity(poolId: string): Promise<boolean> {
    const pool = await this.poolRepository.findOne({
      where: { id: poolId },
    });

    if (!pool) {
      throw new NotFoundException("Pool not found");
    }

    const expectedEscrow =
      Number(pool.escrowedCreatorPledge) +
      Number(pool.escrowedPredictorStakes);
    const actualEscrow = Number(pool.escrowedAmount) || 0;

    const isValid = Math.abs(expectedEscrow - actualEscrow) < 0.01; // Allow small floating point differences

    if (!isValid) {
      this.logger.warn(
        `Escrow integrity check failed for pool ${poolId}: expected ${expectedEscrow}, actual ${actualEscrow}`
      );
    }

    return isValid;
  }
}

