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
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { Incident, IncidentMapPoint, IncidentPage, Pagination } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { PaginationComponent } from '../../shared/pagination';
import { IncidentLocationMapComponent } from './incident-location-map';

@Component({
  standalone: true,
  imports: [IncidentLocationMapComponent, PaginationComponent, RouterLink],
  templateUrl: './map.html',
  styleUrl: './map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentMapComponent implements OnInit, OnDestroy {
  readonly pageSize = 6;
  readonly incidents = signal<Incident[]>([]);
  readonly mapIncidents = signal<IncidentMapPoint[]>([]);
  readonly pagination = signal<Pagination>({
    page: 1,
    limit: this.pageSize,
    total: 0,
    totalPages: 0,
  });
  readonly selectedId = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly mapLoading = signal(true);
  readonly mapError = signal('');
  readonly plottedIncidents = computed(() =>
    this.mapIncidents().filter((incident) => this.hasValidCoordinates(incident)),
  );
  readonly selectedIncident = computed(
    () => this.incidents().find((incident) => incident.id === this.selectedId()) ?? null,
  );

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private listSubscription?: Subscription;
  private mapSubscription?: Subscription;
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
    this.loadMapPoints();
    this.load(1);
    this.realtimeCleanups.push(
      this.realtime.on('incident.created', () => this.refresh()),
      this.realtime.on('incident.updated', () => this.refresh()),
    );
  }

  ngOnDestroy() {
    this.listSubscription?.unsubscribe();
    this.mapSubscription?.unsubscribe();
    this.realtimeCleanups.forEach((cleanup) => cleanup());
    this.destroyMap();
  }

  load(page = this.pagination().page, showLoading = true) {
    if (showLoading) {
      this.loading.set(true);
    }
    this.error.set('');
    this.listSubscription?.unsubscribe();
    this.listSubscription = this.api
      .get<IncidentPage>('admin/incidents', {
        page: String(page),
        limit: String(this.pageSize),
      })
      .subscribe({
        next: (result) => {
          this.incidents.set(result.items);
          this.pagination.set(result.pagination);
          if (!result.items.some((incident) => incident.id === this.selectedId())) {
            this.selectedId.set(result.items[0]?.id ?? '');
          }
          this.loading.set(false);
          queueMicrotask(() => this.renderMarkers(false));
        },
        error: () => {
          this.error.set('ไม่สามารถโหลดตำแหน่งเหตุการณ์ได้');
          this.loading.set(false);
        },
      });
  }

  loadMapPoints(showLoading = true) {
    if (showLoading) {
      this.destroyMap();
      this.mapLoading.set(true);
    }
    this.mapError.set('');
    this.mapSubscription?.unsubscribe();
    this.mapSubscription = this.api
      .get<IncidentMapPoint[]>('admin/incidents/map-points')
      .subscribe({
        next: (items) => {
          this.mapIncidents.set(items);
          this.mapLoading.set(false);
          queueMicrotask(() => this.renderMarkers(true));
        },
        error: () => {
          this.destroyMap();
          this.mapError.set('ไม่สามารถโหลดหมุดเหตุการณ์ทั้งหมดได้');
          this.mapLoading.set(false);
        },
      });
  }

  selectPage(page: number) {
    const current = this.pagination();
    if (page < 1 || page > current.totalPages || page === current.page) {
      return;
    }
    this.load(page);
  }

  private destroyMap() {
    this.map?.remove();
    this.map = undefined;
    this.markerLayer = undefined;
  }

  private refresh() {
    this.load(this.pagination().page, false);
    this.loadMapPoints(false);
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
    for (const incident of this.plottedIncidents()) {
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
      marker.on('click', () => {
        const listedIncident = this.incidents().find((item) => item.id === incident.id);
        if (listedIncident) this.select(listedIncident);
      });
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

  hasValidCoordinates(incident: Incident | IncidentMapPoint) {
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
