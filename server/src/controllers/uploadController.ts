import { Request, Response } from 'express';
import { Readable } from 'stream';
import path from 'path';
import multer from 'multer';
import cloudinary from '../utils/cloudinary';
import prisma from '../lib/prisma';
import { AppError, asyncHandler } from '../lib/errors';
import { assertCanAccessEmployee, assertCanMutateEmployee, requireUser } from '../lib/access';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const RESUME_MIME = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const DOCUMENT_MIME = [...RESUME_MIME, 'image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 6 },
  fileFilter: (_req, file, cb) => {
    const allowed = file.fieldname === 'resume' ? RESUME_MIME : AVATAR_MIME;
    if (file.fieldname === 'files') {
      if (!DOCUMENT_MIME.includes(file.mimetype)) {
        return cb(new AppError(400, 'INVALID_FILE_TYPE', 'Invalid file type. Allowed: PDF, DOC, DOCX, JPEG, PNG, WEBP'));
      }
      return cb(null, true);
    }
    if (!allowed.includes(file.mimetype)) {
      return cb(new AppError(400, 'INVALID_FILE_TYPE', 'Invalid file type'));
    }
    cb(null, true);
  },
});

const sanitizeFileName = (name: string) => path.basename(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

const uploadBufferToCloudinary = (buffer: Buffer, folder: string, fileName: string) =>
  new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: fileName, resource_type: 'auto', overwrite: true },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
        resolve(result.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });

const multerErrorHandler: import('express').ErrorRequestHandler = (err, _req, res, next) => {
  if (err) {
    if (err instanceof AppError) return next(err);
    if ((err as multer.MulterError).code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(400, 'FILE_TOO_LARGE', 'File exceeds the 5MB size limit'));
    }
    if ((err as multer.MulterError).code === 'LIMIT_FILE_COUNT') {
      return next(new AppError(400, 'TOO_MANY_FILES', 'Too many files. Maximum 6 allowed'));
    }
    return next(err);
  }
  next();
};

export const uploadAvatar = [
  upload.single('file'),
  multerErrorHandler,
  asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req.user);
    const employee = await assertCanMutateEmployee(user, String(req.params.id));
    if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'File required');

    const url = await uploadBufferToCloudinary(req.file.buffer, 'ems/avatars', `${employee.employeeId}-${Date.now()}`);
    const updated = await prisma.employee.update({ where: { id: employee.id }, data: { avatarUrl: url } });
    res.json(updated);
  }),
];

export const uploadResume = [
  upload.single('file'),
  multerErrorHandler,
  asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req.user);
    const employee = await assertCanMutateEmployee(user, String(req.params.id));
    if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'File required');

    const url = await uploadBufferToCloudinary(req.file.buffer, 'ems/resumes', `${employee.employeeId}-${Date.now()}`);
    const updated = await prisma.employee.update({ where: { id: employee.id }, data: { resumeUrl: url } });
    res.json(updated);
  }),
];

export const uploadDocuments = [
  upload.array('files', 6),
  multerErrorHandler,
  asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req.user);
    const employee = await assertCanMutateEmployee(user, String(req.params.id));
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0)
      throw new AppError(400, 'FILE_REQUIRED', 'At least one file required');

    const files = req.files as Express.Multer.File[];
    const uploadPromises = files.map(async (file) => {
      const safeName = sanitizeFileName(file.originalname);
      const url = await uploadBufferToCloudinary(file.buffer, 'ems/documents', `${employee.employeeId}-${Date.now()}-${safeName}`);
      return {
        name: safeName,
        url,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      };
    });

    const documents = await Promise.all(uploadPromises);
    const existing = await prisma.employee.findFirst({ where: { id: employee.id }, select: { documents: true } });
    const currentDocs = Array.isArray(existing?.documents) ? existing.documents : [];
    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: { documents: [...currentDocs, ...documents] as unknown as never[] },
    });
    res.json(updated);
  }),
];

export const updateEmployeeSkills = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const employeeId = String(req.params.id);
  await assertCanMutateEmployee(user, employeeId);
  const { skills } = req.body;
  const updated = await prisma.employee.updateMany({
    where: { id: employeeId, tenantId: user.tenantId },
    data: { skills: Array.isArray(skills) ? JSON.stringify(skills) : '' },
  });
  if (updated.count === 0) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  const result = await prisma.employee.findFirst({ where: { id: employeeId, tenantId: user.tenantId } });
  res.json(result);
});
