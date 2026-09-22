import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/** Mute toggle plus a draggable volume slider. */
@Component({
  selector: 'app-volume-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="volume">
      <button
        type="button"
        class="btn-icon"
        [attr.aria-label]="muted() ? 'Unmute' : 'Mute'"
        [title]="muted() ? 'Unmute' : 'Mute'"
        (click)="toggleMute.emit()"
      >
        @if (muted() || volume() === 0) {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M11 5L6 9H2v6h4l5 4V5z" stroke-linejoin="round" />
            <path d="M22 9l-6 6M16 9l6 6" stroke-linecap="round" />
          </svg>
        } @else if (volume() < 0.5) {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M11 5L6 9H2v6h4l5 4V5z" stroke-linejoin="round" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke-linecap="round" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M11 5L6 9H2v6h4l5 4V5z" stroke-linejoin="round" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" stroke-linecap="round" />
          </svg>
        }
      </button>

      <div
        class="slider"
        role="slider"
        tabindex="0"
        aria-label="Volume"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="100"
        [attr.aria-valuenow]="percent()"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (keydown)="onKeyDown($event)"
      >
        <div class="rail">
          <div class="fill" [style.width.%]="percent()"></div>
          <div class="handle" [style.left.%]="percent()"></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .volume {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .btn-icon svg {
        width: 19px;
        height: 19px;
      }

      .slider {
        width: 92px;
        padding: 8px 0;
        cursor: pointer;
        touch-action: none;
      }

      .rail {
        position: relative;
        height: 4px;
        background: var(--border-strong);
        border-radius: var(--radius-full);
      }

      .fill {
        height: 100%;
        background: var(--text-secondary);
        border-radius: var(--radius-full);
        transition: background var(--transition-fast);
      }

      .slider:hover .fill,
      .slider:focus-visible .fill {
        background: var(--accent-bright);
      }

      .handle {
        position: absolute;
        top: 50%;
        width: 12px;
        height: 12px;
        margin-left: -6px;
        background: var(--text-primary);
        border-radius: 50%;
        transform: translateY(-50%) scale(0);
        transition: transform var(--transition-fast);
      }

      .slider:hover .handle,
      .slider:focus-visible .handle {
        transform: translateY(-50%) scale(1);
      }

      @media (max-width: 900px) {
        .slider {
          width: 64px;
        }
      }
    `,
  ],
})
export class VolumeControlComponent {
  /** Volume from 0 to 1. */
  readonly volume = input<number>(0.8);
  readonly muted = input<boolean>(false);

  readonly volumeChange = output<number>();
  readonly toggleMute = output<void>();

  private readonly dragging = signal(false);

  /** Muting shows an empty slider without discarding the stored volume. */
  readonly percent = computed(() => (this.muted() ? 0 : this.volume() * 100));

  onPointerDown(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.emitFromEvent(event);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.dragging()) {
      this.emitFromEvent(event);
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging()) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    this.dragging.set(false);
  }

  onKeyDown(event: KeyboardEvent): void {
    const step = 0.05;
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(this.volume() + step, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(this.volume() - step, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.volumeChange.emit(next);
  }

  private emitFromEvent(event: PointerEvent): void {
    const rail = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = rail.width > 0 ? (event.clientX - rail.left) / rail.width : 0;
    this.volumeChange.emit(Math.min(Math.max(ratio, 0), 1));
  }
}
