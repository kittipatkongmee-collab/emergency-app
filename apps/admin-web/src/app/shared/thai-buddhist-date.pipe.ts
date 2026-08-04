import { Pipe, PipeTransform } from '@angular/core';

export type ThaiBuddhistDateStyle = 'short' | 'medium' | 'long';

@Pipe({
  name: 'thaiBuddhistDate',
  standalone: true,
})
export class ThaiBuddhistDatePipe implements PipeTransform {
  transform(
    value: string | number | Date | null | undefined,
    style: ThaiBuddhistDateStyle = 'medium',
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const dateOptions: Intl.DateTimeFormatOptions =
      style === 'short'
        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
        : {
            day: 'numeric',
            month: style === 'long' ? 'long' : 'short',
            year: 'numeric',
          };
    const datePart = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', dateOptions).format(date);
    const timePart = new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);

    return style === 'long' ? `${datePart} เวลา ${timePart}` : `${datePart} ${timePart}`;
  }
}
