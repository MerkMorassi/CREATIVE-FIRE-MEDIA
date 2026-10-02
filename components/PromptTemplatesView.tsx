
import React, { useState, useEffect, useCallback } from 'react';
import { PromptTemplate } from '../types';
import { getPromptTemplates, savePromptTemplate, deletePromptTemplate, setDefaultPromptTemplate, resetPromptTemplatesToDefault } from '../services/promptTemplateService';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PromptTemplateForm } from './PromptTemplateForm';

const TemplateCard: React.FC<{template: PromptTemplate, isDefault: boolean, onSetDefault: () => void, onEdit: () => void, onDelete: () => void}> = ({ template, isDefault, onSetDefault, onEdit, onDelete }) => (
    <div className="bg-secondary border border-accent rounded-xl p-4 flex flex-col justify-between transition-all hover:border-brand/50 hover:shadow-lg relative min-h-[250px]">
        {isDefault && (
            <div className="absolute top-3 right-3 text-xs font-bold bg-brand text-text-primary px-2 py-0.5 rounded-full">✓ Default</div>
        )}
        
        <div className="flex-grow">
            <h3 className="font-bold text-lg text-text-primary leading-tight truncate pr-20">{template.name}</h3>
            <div className="text-sm text-text-secondary mt-3 p-2 bg-primary/50 rounded-lg overflow-y-auto h-28 space-y-2">
                <div>
                    <p className="text-[10px] uppercase font-bold text-green-400">Positive</p>
                    <p className="whitespace-pre-wrap font-mono text-xs">{template.positivePrompt}</p>
                </div>
                {template.negativePrompt && (
                    <div>
                        <p className="text-[10px] uppercase font-bold text-red-400">Negative</p>
                        <p className="whitespace-pre-wrap font-mono text-xs">{template.negativePrompt}</p>
                    </div>
                )}
            </div>
        </div>
        
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-accent gap-2">
            {!isDefault ? (
            <button 
                onClick={onSetDefault} 
                className="px-4 py-2 text-sm font-semibold bg-primary border border-accent text-text-secondary hover:bg-accent hover:text-text-primary rounded-xl transition-colors flex-grow text-center"
            >
                Set as Default
            </button>
            ) : <div className="flex-grow"></div>}

            <div className="flex gap-1">
                <button onClick={onEdit} className="p-2 text-text-secondary hover:text-white hover:bg-accent rounded-xl transition-colors" title="Edit Template">
                    <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={onDelete} className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-colors" title="Delete Template">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
);


export const PromptTemplatesView: React.FC = () => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  const refreshTemplates = useCallback(() => {
    setTemplates(getPromptTemplates());
  }, []);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsFormVisible(true);
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setIsFormVisible(true);
  };

  const handleSave = (template: Omit<PromptTemplate, 'id' | 'isDefault'> & { id?: string }) => {
    savePromptTemplate(template);
    refreshTemplates();
    setIsFormVisible(false);
    setEditingTemplate(null);
  };

  const handleDelete = (templateId: string) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      deletePromptTemplate(templateId);
      refreshTemplates();
    }
  };

  const handleSetDefault = (templateId: string) => {
    setDefaultPromptTemplate(templateId);
    refreshTemplates();
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all prompt templates to their original defaults?")) {
        resetPromptTemplatesToDefault();
        refreshTemplates();
    }
  }

  const defaultTemplate = templates.find(t => t.isDefault);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Prompt Templates</h2>
            <p className="text-text-secondary">Manage templates for the 'Generate Prompt' feature.</p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-text-secondary hover:text-red-400 hover:underline transition-colors flex-shrink-0 pt-1"
            title="Reset all templates to their initial state."
          >
            Reset to Defaults
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map(template => (
            <TemplateCard 
              key={template.id}
              template={template} 
              isDefault={template.id === defaultTemplate?.id}
              onSetDefault={() => handleSetDefault(template.id)}
              onEdit={() => handleEdit(template)}
              onDelete={() => handleDelete(template.id)}
            />
          ))}

          <button
            onClick={handleCreateNew}
            className="bg-secondary border-2 border-accent border-dashed rounded-xl p-4 flex flex-col items-center justify-center min-h-[250px] transition-all hover:border-brand hover:text-brand text-text-secondary group"
            aria-label="Create a new template"
          >
            <PlusIcon className="w-8 h-8 mb-2 transition-transform group-hover:scale-110" />
            <span className="font-semibold text-lg">Create New Template</span>
          </button>
        </div>
      </div>

      {isFormVisible && (
        <PromptTemplateForm
          template={editingTemplate}
          onSave={handleSave}
          onCancel={() => setIsFormVisible(false)}
        />
      )}
    </div>
  );
};
