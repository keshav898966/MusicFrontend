import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { BrowseCategory, categoriesByGroup } from '../../core/models/categories';

/**
 * Category browser.
 *
 * <p>Audius has no genre entries for Indian styles — Punjabi and Bollywood uploads are
 * filed under Pop, Soundtrack or Hip-Hop/Rap — so this music is reachable only by text
 * search. Each tile runs a saved search, which makes that catalogue discoverable without
 * the listener having to guess the right term.
 */
@Component({
  selector: 'app-browse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="browse">
      <header>
        <h1>Browse</h1>
        <p>
          Pick a category to hear what is on Audius. Indian and regional music is uploaded
          without a matching genre tag, so these searches are the reliable way to find it.
        </p>
      </header>

      @for (section of groups; track section.group) {
        <section>
          <div class="section-title">
            <h2>{{ section.label }}</h2>
          </div>

          <div class="tiles">
            @for (category of section.items; track category.id) {
              <button
                type="button"
                class="tile"
                [style.background]="category.gradient"
                (click)="open(category)"
              >
                <span class="icon" aria-hidden="true">{{ category.icon }}</span>
                <span class="label">{{ category.label }}</span>
              </button>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .browse {
        display: flex;
        flex-direction: column;
        gap: 34px;
      }

      header p {
        margin-top: 8px;
        max-width: 68ch;
        color: var(--text-muted);
        font-size: 0.9375rem;
      }

      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
        gap: 14px;
      }

      .tile {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        aspect-ratio: 16 / 9;
        padding: 14px;
        border-radius: var(--radius-md);
        overflow: hidden;
        text-align: left;
        color: #fff;
        transition: transform var(--transition-base), box-shadow var(--transition-base);
      }

      .tile:hover {
        transform: translateY(-3px) scale(1.015);
        box-shadow: var(--shadow-md);
      }

      .tile:active {
        transform: scale(0.99);
      }

      .icon {
        font-size: 1.5rem;
        line-height: 1;
        /* A soft shadow keeps the glyph legible on the lighter gradients. */
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35));
      }

      .label {
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      }

      @media (max-width: 640px) {
        .tiles {
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }

        .label {
          font-size: 0.9375rem;
        }
      }
    `,
  ],
})
export class BrowseComponent {
  private readonly router = inject(Router);

  readonly groups = categoriesByGroup();

  /** Runs the category's saved search on the search page. */
  open(category: BrowseCategory): void {
    void this.router.navigate(['/search'], { queryParams: { q: category.query } });
  }
}
