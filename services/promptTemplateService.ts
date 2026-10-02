
import { PromptTemplate } from '../types';

const TEMPLATES_STORAGE_KEY = 'prompt-templates-v1';

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'default-cinematic',
    name: 'Cinematic',
    positivePrompt: 'cinematic, dramatic lighting, high detail, 8k, photorealistic, depth of field, masterpiece',
    negativePrompt: 'blurry, low quality, distortion, illustration, painting, cartoon, low resolution, bad anatomy',
    isDefault: true
  },
];

function loadTemplatesFromStorage(): PromptTemplate[] {
  try {
    const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Failed to load prompt templates from localStorage:", error);
    return [];
  }
}

function saveTemplatesToStorage(templates: PromptTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to save prompt templates to localStorage:", error);
  }
}

export function getPromptTemplates(): PromptTemplate[] {
  let templates = loadTemplatesFromStorage();
  if (templates.length === 0) {
    templates = DEFAULT_TEMPLATES;
    saveTemplatesToStorage(templates);
  }
  return templates;
}

export function savePromptTemplate(template: Omit<PromptTemplate, 'id'> & { id?: string }): PromptTemplate {
  const allTemplates = getPromptTemplates();
  const isNew = !template.id;

  const newTemplateData: PromptTemplate = {
    id: template.id || `custom-${crypto.randomUUID()}`,
    name: template.name,
    positivePrompt: template.positivePrompt,
    negativePrompt: template.negativePrompt,
    isDefault: template.isDefault,
  };

  if (isNew) {
    allTemplates.push(newTemplateData);
  } else {
    const existingIndex = allTemplates.findIndex(t => t.id === newTemplateData.id);
    if (existingIndex !== -1) {
      allTemplates[existingIndex] = newTemplateData;
    } else {
      allTemplates.push(newTemplateData);
    }
  }

  saveTemplatesToStorage(allTemplates);
  return newTemplateData;
}

export function deletePromptTemplate(templateId: string): void {
  let allTemplates = getPromptTemplates();
  allTemplates = allTemplates.filter(t => t.id !== templateId);
  saveTemplatesToStorage(allTemplates);
}

export function setDefaultPromptTemplate(templateId: string): void {
    const allTemplates = getPromptTemplates().map(t => ({
        ...t,
        isDefault: t.id === templateId,
    }));
    saveTemplatesToStorage(allTemplates);
}

export function getDefaultPromptTemplate(): PromptTemplate | undefined {
    return getPromptTemplates().find(t => t.isDefault);
}

export function resetPromptTemplatesToDefault(): PromptTemplate[] {
    saveTemplatesToStorage(DEFAULT_TEMPLATES);
    return DEFAULT_TEMPLATES;
}
