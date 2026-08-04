import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { forkJoin, map as mapResult, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { Incident, IncidentPage } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { IncidentLocationMapComponent } from './incident-location-map';

const ACTIVE_INCIDENT_STATUSES = new Set(['RECEIVED', 'FORWARDED', 'INSPECTING', 'IN_PROGRESS']);

@Component({
  standalone: true,
  imports: [RouterLink, IncidentLocationMapComponent],
  templateUrl: './map.html',
  styleUrl: './map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentMapComponent implements OnInit, OnDestroy {
  readonly incidents = signal<Incident[]>([]);
  readonly selectedId = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly activeIncidents = computed(() =>
    this.incidents().filter(
      (incident) =>
        ACTIVE_INCIDENT_STATUSES.has(incident.status) && this.hasValidCoordinates(incident),
    ),
  );
  readonly selectedIncident = computed(
    () => this.incidents().find((incident) => incident.id === this.selectedId()) ?? null,
  );

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private readonly realtimeCleanups: Array<() => void> = [];

  @ViewChild('mapContainer')
  set mapContainer(element: ElementRef<HTMLElement> | undefined) {
    if (element && !this.map) this.initializeMap(element.nativeElement);
  }

  constructor(
    private readonly api: ApiService,
    private readonly realtime: RealtimeService,
  ) {}

  ngOnInit() {
    this.load();
    this.realtimeCleanups.push(
      this.realtime.on('incident.created', () => this.load(false)),
      this.realtime.on('incident.updated', () => this.load(false)),
    );
  }

  ngOnDestroy() {
    this.realtimeCleanups.forEach((cleanup) => cleanup());
    this.map?.remove();
    this.map = undefined;
  }

  load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.error.set('');
    this.fetchAllIncidents().subscribe({
      next: (incidents) => {
        this.incidents.set(incidents);
        if (!incidents.some((incident) => incident.id === this.selectedId())) {
          this.selectedId.set(this.activeIncidents()[0]?.id ?? incidents[0]?.id ?? '');
        }
        this.loading.set(false);
        queueMicrotask(() => this.renderMarkers(true));
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดตำแหน่งเหตุการณ์ได้');
        this.loading.set(false);
      },
    });
  }

  private fetchAllIncidents(): Observable<Incident[]> {
    return this.api.get<IncidentPage>('admin/incidents', { page: '1', limit: '100' }).pipe(
      switchMap((firstPage) => {
        if (firstPage.pagination.totalPages <= 1) return of(firstPage.items);
        const remainingPages = Array.from(
          { length: firstPage.pagination.totalPages - 1 },
          (_, index) =>
            this.api.get<IncidentPage>('admin/incidents', {
              page: String(index + 2),
              limit: '100',
            }),
        );
        return forkJoin(remainingPages).pipe(
          mapResult((pages) => [firstPage.items, ...pages.map((page) => page.items)].flat()),
        );
      }),
    );
  }

  select(incident: Incident) {
    this.selectedId.set(incident.id);
    this.renderMarkers(false);
  }

  statusLabel(status: string) {
    return (
      {
        RECEIVED: 'รอดำเนินการ',
        FORWARDED: 'ส่งต่อเจ้าหน้าที่',
        INSPECTING: 'กำลังตรวจสอบ',
        IN_PROGRESS: 'กำลังดำเนินการ',
        COMPLETED: 'สำเร็จ',
        CANCELLED: 'ยกเลิก',
        REJECTED: 'ปฏิเสธ',
      }[status] ?? status
    );
  }

  private initializeMap(container: HTMLElement) {
    this.map = L.map(container, {
      center: [13.7563, 100.5018],
      zoom: 6,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      keyboard: true,
      zoomControl: true,
    });
    L.tileLayer(environment.mapTileUrl, {
      attribution: environment.mapAttribution,
      maxZoom: 19,
    }).addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.renderMarkers(true);
    queueMicrotask(() => this.map?.invalidateSize());
  }

  private renderMarkers(fitToMarkers: boolean) {
    if (!this.map || !this.markerLayer) return;

    this.markerLayer.clearLayers();
    const locations: L.LatLng[] = [];
    for (const incident of this.activeIncidents()) {
      const location = L.latLng(Number(incident.latitude), Number(incident.longitude));
      locations.push(location);
      const selected = incident.id === this.selectedId();
      const marker = L.marker(location, {
        title: incident.caseCode,
        keyboard: true,
        icon: L.divIcon({
          className: `incident-map-marker${selected ? ' selected' : ''}`,
          html: '<span aria-hidden="true"></span>',
          iconSize: [34, 42],
          iconAnchor: [17, 40],
        }),
      });
      const tooltip = document.createElement('div');
      const caseCode = document.createElement('strong');
      caseCode.textContent = incident.caseCode;
      const address = document.createElement('span');
      address.textContent = incident.address;
      tooltip.append(caseCode, address);
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -34] });
      marker.on('click', () => this.select(incident));
      marker.addTo(this.markerLayer);
    }

    this.map.invalidateSize();
    if (!fitToMarkers || !locations.length) return;
    if (locations.length === 1) {
      this.map.setView(locations[0], 15);
      return;
    }
    this.map.fitBounds(L.latLngBounds(locations), { padding: [48, 48], maxZoom: 16 });
  }

  hasValidCoordinates(incident: Incident) {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }
}
