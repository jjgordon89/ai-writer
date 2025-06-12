// src/services/templateService.ts
import { ProjectTemplate } from '../types'; // Adjust path if your types are structured differently
import { defaultTemplates } from '../templates/defaultTemplates'; // Adjust path

/**
 * Retrieves a list of all available project templates.
 * Returns a deep clone of the templates to prevent modification of the source.
 * @returns {ProjectTemplate[]} An array of available project templates.
 */
export const getAvailableTemplates = (): ProjectTemplate[] => {
  // Deep clone to prevent modification of the original templates array and its objects
  return JSON.parse(JSON.stringify(defaultTemplates));
};

/**
 * Retrieves a specific project template by its ID.
 * Returns a deep clone of the template to prevent modification of the source.
 * @param {string} templateId - The ID of the template to retrieve.
 * @returns {ProjectTemplate | undefined} The found project template, or undefined if not found.
 */
export const getTemplateById = (templateId: string): ProjectTemplate | undefined => {
  const template = defaultTemplates.find(t => t.templateId === templateId);
  if (template) {
    // Deep clone to prevent modification of the original template object
    return JSON.parse(JSON.stringify(template));
  }
  return undefined;
};
