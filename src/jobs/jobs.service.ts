import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupJob } from './entities/backup-job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  constructor(@InjectRepository(BackupJob) private repo: Repository<BackupJob>) {}

  findAll(): Promise<BackupJob[]> {
    return this.repo.find({ relations: ['target'], order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<BackupJob> {
    const job = await this.repo.findOne({ where: { id }, relations: ['target'] });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  findEnabled(): Promise<BackupJob[]> {
    return this.repo.find({ where: { enabled: true }, relations: ['target'] });
  }

  create(dto: CreateJobDto): Promise<BackupJob> {
    const job = this.repo.create({
      ...dto,
      retention_full_count: dto.retention_full_count ?? 7,
      enabled: dto.enabled ?? true,
    });
    return this.repo.save(job);
  }

  async update(id: string, dto: UpdateJobDto): Promise<BackupJob> {
    const job = await this.findOne(id);
    Object.assign(job, dto);
    return this.repo.save(job);
  }

  async remove(id: string): Promise<void> {
    const job = await this.findOne(id);
    job.enabled = false;
    await this.repo.save(job);
  }

  async updateLastRunAt(id: string): Promise<void> {
    await this.repo.update(id, { last_run_at: new Date() });
  }
}
