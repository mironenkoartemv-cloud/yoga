const router = require('express').Router();
const prisma = require('../config/prisma');

const LEGAL_TYPES = ['offer', 'privacy', 'returns'];

const defaultProfile = {
  id: 'main',
  brand: 'Asana',
  legalName: 'Общество с ограниченной ответственностью "Минисофт"',
  shortName: 'ООО "МИНИСОФТ"',
  director: 'Мироненко Артем Витальевич',
  inn: '7814856690',
  kpp: '781401001',
  ogrn: '1257800093187',
  address: '197349, г. Санкт-Петербург, вн. тер. г. муниципальный округ Юнтолово, ул. Парашютная, д. 23, к. 2, литера А, кв. 52',
  registrationDate: '16.10.2025',
  workHours: 'требуется указать режим работы',
  supportPhone: '+79819584828',
  supportEmail: 'mironenko.artemv@gmail.com',
  serviceTitle: 'Онлайн-тренировки по йоге и пилатесу',
  serviceDescription: 'Пользователь покупает доступ к онлайн-занятию в выбранную дату и время. Услуга оказывается дистанционно через видеокомнату на сайте.',
  serviceCountry: 'Российская Федерация',
  serviceCurrency: 'Российский рубль',
  serviceWarranty: 'Услуга оказывается в дату и время, указанные в карточке тренировки.',
  serviceLifetime: 'Срок доступа ограничен временем проведения оплаченной тренировки.',
  serviceSafety: 'Перед занятием оцените самочувствие, освободите место для движения и не выполняйте упражнения при противопоказаниях без консультации врача.',
};

const ensureProfile = async () => {
  const existing = await prisma.legalProfile.findUnique({ where: { id: 'main' } });
  if (existing) return existing;
  return prisma.legalProfile.create({ data: defaultProfile });
};

router.get('/profile', async (req, res, next) => {
  try {
    res.json(await ensureProfile());
  } catch (err) { next(err); }
});

router.get('/documents/current', async (req, res, next) => {
  try {
    const documents = await prisma.legalDocumentVersion.findMany({
      where: { effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    res.json(documents);
  } catch (err) { next(err); }
});

router.get('/documents/:type/current', async (req, res, next) => {
  try {
    if (!LEGAL_TYPES.includes(req.params.type)) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const document = await prisma.legalDocumentVersion.findFirst({
      where: { type: req.params.type, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!document) return res.status(404).json({ error: 'Документ не найден' });
    res.json(document);
  } catch (err) { next(err); }
});

router.get('/documents/:type/archive', async (req, res, next) => {
  try {
    if (!LEGAL_TYPES.includes(req.params.type)) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const documents = await prisma.legalDocumentVersion.findMany({
      where: { type: req.params.type, effectiveTo: { not: null } },
      orderBy: { effectiveFrom: 'desc' },
    });
    res.json(documents);
  } catch (err) { next(err); }
});

module.exports = { router, LEGAL_TYPES, defaultProfile, ensureProfile };
