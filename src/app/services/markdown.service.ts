import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Injectable({
  providedIn: 'root'
})
export class MarkdownService {
  private sanitizer = inject(DomSanitizer);

  constructor() {
    // Configurar marked para renderizar HTML de forma segura
    marked.setOptions({
      breaks: true, // Convertir saltos de línea en <br>
      gfm: true // Habilitar GitHub Flavored Markdown
    });
  }

  /**
   * Convierte Markdown a HTML sanitizado
   * @param markdown Texto en formato Markdown
   * @returns HTML sanitizado como SafeHtml
   */
  toHtml(markdown: string | null | undefined): SafeHtml {
    if (!markdown) {
      return this.sanitizer.sanitize(1, '') || '';
    }

    try {
      // Convertir Markdown a HTML
      const html = marked.parse(markdown);
      
      // Sanitizar el HTML para prevenir XSS
      // El valor 1 corresponde a SecurityContext.HTML
      const sanitized = this.sanitizer.sanitize(1, html);
      
      return this.sanitizer.bypassSecurityTrustHtml(sanitized || '');
    } catch (error) {
      console.error('Error al parsear Markdown:', error);
      // Si hay un error, devolver el texto original escapado
      return this.sanitizer.sanitize(1, this.escapeHtml(markdown)) || '';
    }
  }

  /**
   * Escapa HTML para prevenir XSS (fallback)
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
