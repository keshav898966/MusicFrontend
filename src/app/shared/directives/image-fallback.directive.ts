import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Hides an image that fails to load.
 *
 * <p>Audius serves artwork from a rotating set of community-run content nodes, and some
 * of those hosts are intermittently unreachable. Rather than leaving a broken-image icon,
 * the element is hidden so the styled placeholder behind it shows through.
 */
@Directive({
  selector: 'img[appImageFallback]',
  host: {
    '(error)': 'onError()',
    '(load)': 'onLoad()',
  },
})
export class ImageFallbackDirective {
  private readonly element = inject(ElementRef<HTMLImageElement>);

  onError(): void {
    const img = this.element.nativeElement as HTMLImageElement;
    img.style.visibility = 'hidden';
    // Marks the container so a CSS placeholder can take over.
    img.parentElement?.classList.add('image-failed');
  }

  onLoad(): void {
    const img = this.element.nativeElement as HTMLImageElement;
    img.style.visibility = 'visible';
    img.parentElement?.classList.remove('image-failed');
  }
}
