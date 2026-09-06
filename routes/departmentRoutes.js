const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAllSpecializations
} = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

router.get('/', getAllDepartments);
router.get('/specializations', getAllSpecializations);
router.get('/:id', getDepartmentById);

router.post(
  '/',
  authenticate,
  authorize('Admin'),
  validateRequest({
    name: { required: true, minLength: 2, label: 'Department Name' },
    description: { required: true, minLength: 5, label: 'Department Description' }
  }),
  createDepartment
);

router.put('/:id', authenticate, authorize('Admin'), updateDepartment);
router.delete('/:id', authenticate, authorize('Admin'), deleteDepartment);

module.exports = router;
