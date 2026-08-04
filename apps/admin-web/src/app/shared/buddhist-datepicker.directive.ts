import { AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';
import flatpickr from 'flatpickr';
import { Thai } from 'flatpickr/dist/l10n/th.js';
import { Instance } from 'flatpickr/dist/types/instance';

const BUDDHIST_YEAR_OFFSET = 543;

@Directive({
  selector: 'input[appBuddhistDatepicker]',
  standalone: true,
})
export class BuddhistDatepickerDirective implements AfterViewInit, OnDestroy {
  private picker?: Instance;

  constructor(private readonly elementRef: ElementRef<HTMLInputElement>) {}

  ngAfterViewInit(): void {
    this.picker = flatpickr(this.elementRef.nativeElement, {
      locale: Thai,
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      ariaDateFormat: 'j F Y',
      allowInput: false,
      disableMobile: true,
      formatDate: (date, format) => this.formatDate(date, format),
      onReady: [(_dates, _value, instance) => this.showBuddhistYear(instance)],
      onOpen: [(_dates, _value, instance) => this.showBuddhistYear(instance)],
      onMonthChange: [(_dates, _value, instance) => this.showBuddhistYear(instance)],
      onYearChange: [(_dates, _value, instance) => this.showBuddhistYear(instance)],
    });
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
  }

  clear(): void {
    this.picker?.clear();
  }

  private formatDate(date: Date, format: string): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    if (format === 'Y-m-d') {
      return `${date.getFullYear()}-${month}-${day}`;
    }

    if (format === 'd/m/Y') {
      return `${day}/${month}/${date.getFullYear() + BUDDHIST_YEAR_OFFSET}`;
    }

    return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private showBuddhistYear(instance: Instance): void {
    instance.currentYearElement.readOnly = true;
    instance.currentYearElement.setAttribute(
      'aria-label',
      `ปี พ.ศ. ${instance.currentYear + BUDDHIST_YEAR_OFFSET}`,
    );

    const wrapper = instance.currentYearElement.parentElement;
    if (!wrapper) {
      return;
    }

    let label = wrapper.querySelector<HTMLElement>('.buddhist-year-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'buddhist-year-label';
      label.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(label);
    }
    label.textContent = String(instance.currentYear + BUDDHIST_YEAR_OFFSET);
  }
}
