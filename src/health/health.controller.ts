import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async getHealth() {
    return this.healthService.getHealth();
  }

  /** Page navigateur : affiche une alert() avec l’état Supabase (même origine que l’API) */
  @Get('health/ui')
  @Header('Content-Type', 'text/html; charset=utf-8')
  healthUi(): string {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>حالة Supabase</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
    pre { background: #111827; color: #e5e7eb; padding: 1rem; border-radius: 8px; overflow: auto; font-size: 0.85rem; }
    .ok { color: #059669; }
    .fail { color: #dc2626; }
  </style>
</head>
<body>
  <h1>التحقق من Supabase</h1>
  <p id="loading">جاري الاتصال بالخادم…</p>
  <pre id="out" hidden></pre>
  <script>
    fetch('/health')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var c = d.supabase && d.supabase.connected;
        var msg = (d.supabase && d.supabase.message) || '';
        var line = c ? 'Supabase: متصل ✓' : 'Supabase: غير متصل ✗';
        alert(line + '\\n\\n' + msg);
        document.getElementById('loading').textContent = line;
        document.getElementById('loading').className = c ? 'ok' : 'fail';
        var pre = document.getElementById('out');
        pre.textContent = JSON.stringify(d, null, 2);
        pre.hidden = false;
      })
      .catch(function (e) {
        alert('خطأ: ' + (e && e.message ? e.message : String(e)));
        document.getElementById('loading').textContent = 'فشل الطلب';
        document.getElementById('loading').className = 'fail';
      });
  </script>
</body>
</html>`;
  }
}
