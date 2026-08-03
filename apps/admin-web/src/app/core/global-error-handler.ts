import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown) {
    console.error('เกิดข้อผิดพลาดที่ไม่คาดคิดในหน้าจอ', error);
  }
}
