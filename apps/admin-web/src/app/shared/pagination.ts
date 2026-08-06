import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Pagination } from '../core/models';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  @Input({ required: true }) pagination!: Pagination;
  @Input() windowSize = 4;
  @Output() readonly pageChange = new EventEmitter<number>();

  get visiblePages(): number[] {
    const { page, totalPages } = this.pagination;
    if (totalPages <= 0 || this.windowSize <= 0) return [];
    const visibleCount = Math.min(totalPages, this.windowSize);
    const latestStart = totalPages - visibleCount + 1;
    const start = Math.max(1, Math.min(page, latestStart));
    return Array.from({ length: visibleCount }, (_, index) => start + index);
  }

  selectPage(page: number) {
    if (page < 1 || page > this.pagination.totalPages || page === this.pagination.page) {
      return;
    }
    this.pageChange.emit(page);
  }
}
