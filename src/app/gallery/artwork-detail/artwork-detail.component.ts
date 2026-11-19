import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ArtworkService } from '../../services/artwork.service';
import { CommonModule } from '@angular/common';
import { SeoService, slugify } from '../../seo/seo.service';

declare var bootstrap: any;

@Component({
  selector: 'app-artwork-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artwork-detail.component.html',
  styleUrl: './artwork-detail.component.css'
})
export class ArtworkDetailComponent {
  folder: string | null = null;
  artworks: any[] = [];
  fullImageUrl: string | null = null; // <-- add this for modal image

  constructor(
    private route: ActivatedRoute,
    private artworkService: ArtworkService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private seo: SeoService
  ) {
    this.folder = this.route.snapshot.paramMap.get('folder');
  }

  ngAfterViewInit(): void {
    this.artworkService.getArtworks().subscribe((data) => {
      const allArtworks = data;
      if (this.folder) {
        // Accept both the slug (/artwork/esenta-vietii) and the legacy folder name
        // (/artwork/Esența vieții) used by the old hash URLs.
        const param = this.folder;
        const filtered = allArtworks.filter(
          art => slugify(art.folder) === slugify(param) || art.title === param
        );
        this.artworks = filtered.length > 0 ? filtered : [];
        const art = this.artworks[0];
        if (art) {
          const slug = slugify(art.folder);
          if (param !== slug) {
            this.router.navigate(['/artwork', slug], { replaceUrl: true });
          }
          this.updateSeo(art, slug);
        }
      } else {
        this.artworks = allArtworks;
      }
      this.cdr.detectChanges();
    });
  }

  altText(index: number): string {
    const art = this.artworks[0];
    if (!art) return 'Painting by Flori Bulduș';
    const name = art.info?.title && art.info.title !== art.title
      ? `${art.title} (${art.info.title})`
      : art.title;
    return index === 0
      ? `${name} – painting by Flori Bulduș`
      : `${name} – detail ${index}, painting by Flori Bulduș`;
  }

  private updateSeo(art: any, slug: string) {
    const en = art.info?.title;
    const name = en && en !== art.title ? `${art.title} (${en})` : art.title;
    const extra = art.info?.additional_info;
    const facts = [extra?.technique, extra?.dimensions].filter(Boolean).join(', ');
    const text = (art.info?.description ?? '').replace(/\s+/g, ' ').trim();
    const description = (
      `${name} by Romanian artist Flori Bulduș${facts ? ` – ${facts}` : ''}. ${text}`
    ).slice(0, 300);
    this.seo.setPage({
      title: `${name} – Painting by Flori Bulduș`,
      description,
      path: `/artwork/${slug}/`,
      image: `assets/paintings/${art.folder}/${art.images[0]}`
    });
  }

  showFullImage(imageUrl: string) {
    this.fullImageUrl = imageUrl;
    this.cdr.detectChanges(); // ensure Angular updates modal
    const modalElement = document.getElementById('fullImageModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
      modal.show();
    }
  }

  closeFullImage() {
    const modalElement = document.getElementById('fullImageModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal?.hide();
    }
  }
}
