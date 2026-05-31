import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupTarget } from './entities/backup-target.entity';
import { CreateTargetDto } from './dto/create-target.dto';
import { UpdateTargetDto } from './dto/update-target.dto';

@Injectable()
export class TargetsService {
  constructor(@InjectRepository(BackupTarget) private repo: Repository<BackupTarget>) {}

  findAll(): Promise<BackupTarget[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<BackupTarget> {
    const target = await this.repo.findOne({ where: { id } });
    if (!target) throw new NotFoundException(`Target ${id} not found`);
    return target;
  }

  create(dto: CreateTargetDto): Promise<BackupTarget> {
    const target = this.repo.create({ ...dto, enabled: dto.enabled ?? true });
    return this.repo.save(target);
  }

  async update(id: string, dto: UpdateTargetDto): Promise<BackupTarget> {
    const target = await this.findOne(id);
    Object.assign(target, dto);
    return this.repo.save(target);
  }

  async remove(id: string): Promise<void> {
    const target = await this.findOne(id);
    await this.repo.remove(target);
  }
}
