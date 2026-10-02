export const simpleMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';

    let cleanMarkdown = markdown
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/^```html\s*/i, '')
        .replace(/```$/i, '');

    let html = cleanMarkdown
        .replace(/^--- (.*?) ---$/gim, '<h2 class="text-xl font-black text-blue-400 mt-10 mb-5 border-l-4 border-blue-600 pl-4 uppercase tracking-tight">$1</h2>')
        
        .replace(/^\s*(INT\.|EXT\.)\s+(.*?)$/gim, '<h3 class="text-lg font-black text-white mt-8 mb-4 uppercase tracking-wider">$1 $2</h3>')

        .replace(/^\s*### (.*$)/gim, '<h3 class="text-lg font-black text-blue-400 mt-8 mb-4 uppercase tracking-wider">$1</h3>')
        .replace(/^\s*## (.*$)/gim, '<h2 class="text-2xl font-black text-white mt-10 mb-5 border-l-4 border-blue-600 pl-4 uppercase tracking-tight">$1</h2>')
        .replace(/^\s*# (.*$)/gim, '<h1 class="text-3xl font-black text-white mt-12 mb-6 border-b-2 border-accent pb-3 uppercase tracking-tighter">$1</h1>')
        
        .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-white font-bold">$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em class="text-neutral-300 italic">$1</em>')
        
        .replace(/^\s*> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-6 py-2 my-6 italic text-neutral-400 bg-blue-900/10 rounded-r-lg shadow-inner">$1</blockquote>')
        
        .replace(/^\s*---\s*$/gim, '<hr class="border-neutral-800 my-10" />')

        .replace(/^\s*[-*]\s+(.*$)/gim, '<div class="flex gap-3 mb-2 ml-4"><span class="text-blue-500 font-black">•</span><span class="text-neutral-400">$1</span></div>');

    const blocks = html.split(/\n\n+/);
    
    return blocks.map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        
        if (trimmed.match(/^<(h1|h2|h3|blockquote|div|hr|pre)/i)) {
            return trimmed.replace(/\n/g, '<br/>'); 
        }
        
        return `<p class="mb-6 leading-relaxed text-neutral-400">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    }).join('');
};