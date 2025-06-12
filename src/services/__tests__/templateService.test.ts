// src/services/__tests__/templateService.test.ts
import { getAvailableTemplates, getTemplateById } from '../templateService';
import { defaultTemplates } from '../../templates/defaultTemplates';
import { ProjectTemplate } from '../../types';

describe('Template Service', () => {
  describe('getAvailableTemplates', () => {
    it('should return all default templates', () => {
      const templates = getAvailableTemplates();
      expect(templates).toHaveLength(defaultTemplates.length);
    });

    it('should return a deep clone of the templates array', () => {
      const templates = getAvailableTemplates();
      expect(templates).not.toBe(defaultTemplates); // Check array instance
      if (templates.length > 0 && defaultTemplates.length > 0) {
        expect(templates[0]).not.toBe(defaultTemplates[0]); // Check object instance
        templates[0].templateName = 'Modified Name';
        expect(defaultTemplates[0].templateName).not.toBe('Modified Name');
      }
    });
  });

  describe('getTemplateById', () => {
    it('should return the correct template by ID', () => {
      const firstTemplateId = defaultTemplates[0].templateId;
      const template = getTemplateById(firstTemplateId);
      expect(template).toBeDefined();
      expect(template?.templateId).toBe(firstTemplateId);
    });

    it('should return undefined for a non-existent ID', () => {
      const template = getTemplateById('non-existent-id');
      expect(template).toBeUndefined();
    });

    it('should return a deep clone of the template', () => {
      if (defaultTemplates.length === 0) return;
      const firstTemplateId = defaultTemplates[0].templateId;
      const template = getTemplateById(firstTemplateId) as ProjectTemplate;
      expect(template).not.toBe(defaultTemplates[0]);
      template.templateName = 'Another Modified Name';
      expect(defaultTemplates[0].templateName).not.toBe('Another Modified Name');
    });
  });
});
