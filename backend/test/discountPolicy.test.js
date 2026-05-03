const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaPath = path.resolve(__dirname, '../src/config/prisma.js');

const makeMockPrisma = () => ({
  _discounts: [],
  _bookings: [],
  booking: {
    findFirst: async () => null,
  },
  userDiscount: {
    findFirst: async function ({ where }) {
      return this._root._discounts.find((d) => {
        if (where.userId && d.userId !== where.userId) return false;
        if (where.usedAt === null && d.usedAt !== null) return false;
        if (where.reason?.in && !where.reason.in.includes(d.reason)) return false;
        return true;
      }) || null;
    },
    create: async function ({ data }) {
      const item = { id: `discount-${this._root._discounts.length + 1}`, usedAt: null, ...data };
      this._root._discounts.push(item);
      return item;
    },
    update: async function ({ where, data }) {
      const item = this._root._discounts.find((d) => d.id === where.id);
      Object.assign(item, data);
      return item;
    },
  },
});

const loadServiceWithMock = () => {
  const mock = makeMockPrisma();
  mock.userDiscount._root = mock;
  delete require.cache[prismaPath];
  require.cache[prismaPath] = { exports: mock };

  const servicePath = path.resolve(__dirname, '../src/services/trainingOutcomeService.js');
  delete require.cache[servicePath];
  return { mock, service: require(servicePath) };
};

test('apology discount is permanent', async () => {
  const { service } = loadServiceWithMock();

  const discount = await service.grantPostTrainingDiscount({
    userId: 'user-1',
    trainingId: 'training-1',
    reason: 'TRAINER_NO_SHOW',
  });

  assert.equal(discount.reason, 'TRAINER_NO_SHOW');
  assert.equal(discount.expiresAt, null);
});

test('reactivation discount expires in the future', async () => {
  const { service } = loadServiceWithMock();

  const discount = await service.grantPostTrainingDiscount({
    userId: 'user-1',
    trainingId: 'training-1',
    reason: 'NORMAL_FINISH',
  });

  assert.equal(discount.reason, 'NORMAL_FINISH');
  assert.ok(discount.expiresAt instanceof Date);
});

test('reactivation does not replace existing apology discount', async () => {
  const { service } = loadServiceWithMock();

  const apology = await service.grantPostTrainingDiscount({
    userId: 'user-1',
    trainingId: 'training-1',
    reason: 'TRAINER_NO_SHOW',
  });
  const reactivation = await service.grantPostTrainingDiscount({
    userId: 'user-1',
    trainingId: 'training-2',
    reason: 'NORMAL_FINISH',
  });

  assert.equal(reactivation, null);
  assert.equal(apology.reason, 'TRAINER_NO_SHOW');
});

test('apology replaces active reactivation discount', async () => {
  const { service } = loadServiceWithMock();

  await service.grantPostTrainingDiscount({
    userId: 'user-1',
    trainingId: 'training-1',
    reason: 'NORMAL_FINISH',
  });
  const apology = await service.grantPostTrainingDiscount({
    userId: 'user-1',
    trainingId: 'training-2',
    reason: 'TRAINER_DISCONNECT',
  });

  assert.equal(apology.reason, 'TRAINER_DISCONNECT');
  assert.equal(apology.expiresAt, null);
});
