import request from 'supertest';
import app from '../index';
import { getDb } from '../db';
import { seedDemoData } from '../seed';

describe('Employee Details, Login Aliases, and Availability Synchronization', () => {
  beforeAll(() => {
    seedDemoData();
  });

  describe('Usernames and Login Conventions', () => {
    it('allows Devon Miller to log in using miller_d and devon_miller', async () => {
      const resPrimary = await request(app)
        .post('/api/auth/login')
        .send({ username: 'miller_d', password: 'password123' });
      expect(resPrimary.status).toBe(200);
      expect(resPrimary.body.user.employeeName).toBe('Devon Miller');

      const resAlias = await request(app)
        .post('/api/auth/login')
        .send({ username: 'devon_miller', password: 'password123' });
      expect(resAlias.status).toBe(200);
      expect(resAlias.body.user.employeeName).toBe('Devon Miller');
    });

    it('allows Kofi Achebe to log in using achebe_k and gii_fieldlead', async () => {
      const resPrimary = await request(app)
        .post('/api/auth/login')
        .send({ username: 'achebe_k', password: 'password123' });
      expect(resPrimary.status).toBe(200);
      expect(resPrimary.body.user.employeeName).toBe('Kofi Achebe');

      const resAlias = await request(app)
        .post('/api/auth/login')
        .send({ username: 'gii_fieldlead', password: 'password123' });
      expect(resAlias.status).toBe(200);
      expect(resAlias.body.user.employeeName).toBe('Kofi Achebe');
    });

    it('allows Marcus Vance to log in using vance_m and gii_ceo', async () => {
      const resPrimary = await request(app)
        .post('/api/auth/login')
        .send({ username: 'vance_m', password: 'password123' });
      expect(resPrimary.status).toBe(200);
      expect(resPrimary.body.user.isManager).toBe(true);

      const resAlias = await request(app)
        .post('/api/auth/login')
        .send({ username: 'gii_ceo', password: 'password123' });
      expect(resAlias.status).toBe(200);
      expect(resAlias.body.user.isManager).toBe(true);
    });
  });

  describe('Employee Details & Availability Sync to Manager', () => {
    let kofiToken: string;
    let kofiEmployeeId: number;
    let managerToken: string;

    beforeAll(async () => {
      const kofiLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: 'gii_fieldlead', password: 'password123' });
      kofiToken = kofiLogin.body.token;
      kofiEmployeeId = kofiLogin.body.user.employeeId;

      const managerLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: 'gii_ceo', password: 'password123' });
      managerToken = managerLogin.body.token;
    });

    it('allows employee to update emergency contact and availability', async () => {
      const profileRes = await request(app)
        .put(`/api/employees/${kofiEmployeeId}`)
        .set('Authorization', `Bearer ${kofiToken}`)
        .send({
          emergency_contact: '(555) 888-9999 (Spouse)',
          phone: '(555) 777-1111',
        });
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.emergency_contact).toBe('(555) 888-9999 (Spouse)');

      const availRes = await request(app)
        .post(`/api/employees/${kofiEmployeeId}/availability`)
        .set('Authorization', `Bearer ${kofiToken}`)
        .send({
          day_of_week: 1,
          availability_type: 'unavailable',
        });
      expect(availRes.status).toBe(201);
      expect(availRes.body.availability_type).toBe('unavailable');
    });

    it('manager receives the updated profile, 7-day availability, and conflict warnings via GET /api/employees/:id', async () => {
      const detailRes = await request(app)
        .get(`/api/employees/${kofiEmployeeId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.name).toBe('Kofi Achebe');
      expect(detailRes.body.emergency_contact).toBe('(555) 888-9999 (Spouse)');
      expect(detailRes.body.phone).toBe('(555) 777-1111');

      const mondayAvail = detailRes.body.availability.find((a: any) => a.day_of_week === 1);
      expect(mondayAvail).toBeDefined();
      expect(mondayAvail.availability_type).toBe('unavailable');

      expect(Array.isArray(detailRes.body.conflicts)).toBe(true);
    });

    it('returns bulk availability for manager', async () => {
      const bulkRes = await request(app)
        .get('/api/employees/availability')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(bulkRes.status).toBe(200);
      expect(Array.isArray(bulkRes.body)).toBe(true);
      expect(bulkRes.body.length).toBeGreaterThan(0);
      const kofiMonday = bulkRes.body.find((a: any) => a.employee_id === kofiEmployeeId && a.day_of_week === 1);
      expect(kofiMonday).toBeDefined();
      expect(kofiMonday.availability_type).toBe('unavailable');
    });
  });
});
