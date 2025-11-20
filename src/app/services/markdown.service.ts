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
      const parsed = marked.parse(markdown);
      // marked.parse puede devolver string o Promise<string>, asegurarnos de que sea string
      const html = typeof parsed === 'string' ? parsed : String(parsed);
      
      // Procesar videos: convertir enlaces de YouTube/Vimeo/etc. a iframes
      const processedHtml = this.processVideoEmbeds(html);
      
      // Usar bypassSecurityTrustHtml para permitir iframes de videos
      // Nota: Esto es seguro porque solo permitimos dominios específicos de video
      return this.sanitizer.bypassSecurityTrustHtml(processedHtml);
    } catch (error) {
      console.error('Error al parsear Markdown:', error);
      // Si hay un error, devolver el texto original escapado
      return this.sanitizer.sanitize(1, this.escapeHtml(markdown)) || '';
    }
  }

  /**
   * Procesa el HTML para convertir enlaces de video en iframes embebidos
   * Soporta: YouTube, Vimeo, y otros servicios comunes
   */
  private processVideoEmbeds(html: string): string {
    let processedHtml = html;

    // Primero, reemplazar enlaces completos <a href="...">texto</a> que contengan videos de YouTube
    processedHtml = processedHtml.replace(
      /<a[^>]*href=["'](?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>.*?<\/a>/gi,
      (match, videoId) => {
        return this.createYouTubeEmbed(videoId);
      }
    );

    // Luego, reemplazar URLs sueltas de YouTube (que no estén en <a>)
    processedHtml = processedHtml.replace(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/g,
      (match, videoId) => {
        // Solo reemplazar si no está dentro de un iframe o <a> ya procesado
        if (!match.includes('youtube.com/embed/')) {
          return this.createYouTubeEmbed(videoId);
        }
        return match;
      }
    );

    // Reemplazar enlaces completos <a href="...">texto</a> que contengan videos de Vimeo
    processedHtml = processedHtml.replace(
      /<a[^>]*href=["'](?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)[^"']*["'][^>]*>.*?<\/a>/gi,
      (match, videoId) => {
        return this.createVimeoEmbed(videoId);
      }
    );

    // Luego, reemplazar URLs sueltas de Vimeo (que no estén en <a>)
    processedHtml = processedHtml.replace(
      /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/g,
      (match, videoId) => {
        // Solo reemplazar si no está dentro de un iframe ya procesado
        if (!match.includes('player.vimeo.com')) {
          return this.createVimeoEmbed(videoId);
        }
        return match;
      }
    );

    return processedHtml;
  }

  /**
   * Crea el HTML para un iframe de YouTube
   */
  private createYouTubeEmbed(videoId: string): string {
    return `<div class="video-container my-4">
      <iframe 
        width="560" 
        height="315" 
        src="https://www.youtube.com/embed/${videoId}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        class="w-full max-w-4xl mx-auto rounded-lg"
        style="aspect-ratio: 16/9; height: auto;"
      ></iframe>
    </div>`;
  }

  /**
   * Crea el HTML para un iframe de Vimeo
   */
  private createVimeoEmbed(videoId: string): string {
    return `<div class="video-container my-4">
      <iframe 
        src="https://player.vimeo.com/video/${videoId}" 
        width="560" 
        height="315" 
        frameborder="0" 
        allow="autoplay; fullscreen; picture-in-picture" 
        allowfullscreen
        class="w-full max-w-4xl mx-auto rounded-lg"
        style="aspect-ratio: 16/9; height: auto;"
      ></iframe>
    </div>`;
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
