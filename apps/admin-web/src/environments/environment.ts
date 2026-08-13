export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8085/api/v1',
  mediaBaseUrl: 'http://localhost:8085',
  firebase: {
    enabled: true,
    apiKey: 'AIzaSyArCK819k-4o4xyYxbs3Ui8uKUlYiGyr24',
    authDomain: 'sar-police-emc.firebaseapp.com',
    databaseURL:
      'https://sar-police-emc-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'sar-police-emc',
    messagingSenderId: '609936016898',
    appId: '1:609936016898:web:b3035205625aef17ce491b',
  },
  mapEmbedBaseUrl: 'https://www.openstreetmap.org/export/embed.html',
  mapTileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  mapAttribution: '&copy; OpenStreetMap contributors &copy; CARTO',
};
