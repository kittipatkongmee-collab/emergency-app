import 'reflect-metadata';
import { IncidentType } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateIncidentDto } from './incidents.dto';

function incidentDto(phone: string) {
  return Object.assign(new CreateIncidentDto(), {
    reporterName: 'ผู้แจ้งทดสอบ',
    reporterPhone: phone,
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'รายละเอียดเหตุการณ์สำหรับทดสอบ',
    latitude: '13.7563000',
    longitude: '100.5018000',
    address: 'พิกัด 13.7563000, 100.5018000',
  });
}

describe('CreateIncidentDto', () => {
  it('ยอมรับหมายเลขติดต่อที่ตรงกับกฎในแอป', async () => {
    await expect(validate(incidentDto('0474464467'))).resolves.toHaveLength(0);
  });

  it('ปฏิเสธหมายเลขติดต่อที่ไม่ได้ขึ้นต้นด้วยศูนย์', async () => {
    const errors = await validate(incidentDto('1474464467'));
    expect(errors.some((error) => error.property === 'reporterPhone')).toBe(
      true,
    );
  });
});
