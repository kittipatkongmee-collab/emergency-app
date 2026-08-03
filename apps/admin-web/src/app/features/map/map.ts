import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { Incident, IncidentPage } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';

interface MapBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

interface IncidentMarker {
  incident: Incident;
  left: number;
  top: number;
}

@Component({
  standalone: true,
  imports: [RouterLink],
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
      (incident) => incident.status !== 'COMPLETED' && this.hasValidCoordinates(incident),
    ),
  );
  readonly selectedIncident = computed(
    () => this.incidents().find((incident) => incident.id === this.selectedId()) ?? null,
  );
  readonly bounds = computed<MapBounds>(() => this.calculateBounds(this.activeIncidents()));
  readonly markers = computed<IncidentMarker[]>(() => {
    const bounds = this.bounds();
    const longitudeSpan = bounds.maxLongitude - bounds.minLongitude;
    const latitudeSpan = bounds.maxLatitude - bounds.minLatitude;
    return this.activeIncidents().map((incident) => ({
      incident,
      left: ((Number(incident.longitude) - bounds.minLongitude) / longitudeSpan) * 100,
      top: ((bounds.maxLatitude - Number(incident.latitude)) / latitudeSpan) * 100,
    }));
  });
  readonly mapUrl = computed<SafeResourceUrl>(() => {
    const bounds = this.bounds();
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `${environment.mapEmbedBaseUrl}?bbox=${bounds.minLongitude}%2C${bounds.minLatitude}%2C${bounds.maxLongitude}%2C${bounds.maxLatitude}&layer=mapnik`,
    );
  });
  private readonly realtimeCleanups: Array<() => void> = [];

  constructor(
    private readonly api: ApiService,
    private readonly sanitizer: DomSanitizer,
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
  }

  load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.error.set('');
    this.api.get<IncidentPage>('admin/incidents', { limit: '100' }).subscribe({
      next: (result) => {
        this.incidents.set(result.items);
        if (!result.items.some((incident) => incident.id === this.selectedId())) {
          const firstActive = result.items.find((incident) => incident.status !== 'COMPLETED');
          this.selectedId.set(firstActive?.id ?? result.items[0]?.id ?? '');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดตำแหน่งเหตุการณ์ได้');
        this.loading.set(false);
      },
    });
  }

  select(incident: Incident) {
    this.selectedId.set(incident.id);
  }

  statusLabel(status: string) {
    return (
      {
        RECEIVED: 'รับแจ้งแล้ว',
        FORWARDED: 'ส่งต่อเจ้าหน้าที่',
        INSPECTING: 'กำลังตรวจสอบ',
        IN_PROGRESS: 'กำลังดำเนินการ',
        COMPLETED: 'สำเร็จ',
        CANCELLED: 'ยกเลิก',
        REJECTED: 'ปฏิเสธ',
      }[status] ?? status
    );
  }

  private hasValidCoordinates(incident: Incident) {
    return (
      Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude))
    );
  }

  private calculateBounds(incidents: Incident[]): MapBounds {
    if (!incidents.length) {
      return {
        minLatitude: 5.5,
        maxLatitude: 20.5,
        minLongitude: 97,
        maxLongitude: 106,
      };
    }
    const latitudes = incidents.map((incident) => Number(incident.latitude));
    const longitudes = incidents.map((incident) => Number(incident.longitude));
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.15, 0.01);
    const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.15, 0.01);
    return {
      minLatitude: minLatitude - latitudePadding,
      maxLatitude: maxLatitude + latitudePadding,
      minLongitude: minLongitude - longitudePadding,
      maxLongitude: maxLongitude + longitudePadding,
    };
  }
}
