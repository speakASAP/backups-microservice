import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { BackupDestination } from './entities/backup-destination.entity';

@Injectable()
export class DestinationsService {
  constructor(@InjectRepository(BackupDestination) private readonly repo: Repository<BackupDestination>) {}

  findAll(): Promise<BackupDestination[]> {
    return this.repo.find({ order: { enabled: 'DESC', priority: 'ASC', created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<BackupDestination> {
    const destination = await this.repo.findOne({ where: { id } });
    if (!destination) throw new NotFoundException(`Destination ${id} not found`);
    return destination;
  }

  create(dto: CreateDestinationDto): Promise<BackupDestination> {
    const destination = this.repo.create({
      ...dto,
      enabled: dto.enabled ?? true,
      priority: dto.priority ?? 100,
    });
    return this.repo.save(destination);
  }

  async update(id: string, dto: UpdateDestinationDto): Promise<BackupDestination> {
    const destination = await this.findOne(id);
    Object.assign(destination, dto);
    return this.repo.save(destination);
  }

  async remove(id: string): Promise<void> {
    const destination = await this.findOne(id);
    destination.enabled = false;
    await this.repo.save(destination);
  }
}
