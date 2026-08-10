<?php

namespace Police\Api;

use FastRoute\RouteCollector;

final class App
{
    private $root;
    private $config;
    private $db;
    private $auth;
    private $firebase;
    private $controller;
    private $limiter;

    public function __construct($root)
    {
        $this->root = $root;
        $this->config = new Config($root);
        date_default_timezone_set($this->config->get('APP_TIMEZONE', 'UTC'));
        $this->db = new Database($this->config);
        $this->auth = new AuthService($this->db, $this->config);
        $this->firebase = new FirebaseService($this->db, $this->config);
        $this->limiter = new RateLimiter($this->db);
        $this->controller = new ApiController($this->db, $this->config, $this->auth, $this->firebase, new ImageStorage($this->db, $this->config));
    }

    public function run()
    {
        $request = null;
        $started = microtime(true);
        try {
            $request = Request::capture();
            $this->cors($request);
            if ($request->method === 'OPTIONS') {
                http_response_code(204);
                return;
            }
            $routes = $this->routes();
            $dispatcher = \FastRoute\simpleDispatcher(function (RouteCollector $collector) use ($routes) {
                foreach ($routes as $route) {
                    $collector->addRoute($route[0], $route[1], $route);
                }
            });
            $routeInfo = $dispatcher->dispatch($request->method, $request->path);
            if ($routeInfo[0] === \FastRoute\Dispatcher::NOT_FOUND) {
                throw new ApiException(404, 'NOT_FOUND', 'ไม่พบเส้นทางที่ร้องขอ');
            }
            if ($routeInfo[0] === \FastRoute\Dispatcher::METHOD_NOT_ALLOWED) {
                throw new ApiException(405, 'METHOD_NOT_ALLOWED', 'ไม่รองรับวิธีการร้องขอนี้');
            }
            $route = $routeInfo[1];
            $request->params = $routeInfo[2];
            if (!$route[3]) {
                $request->principal = $this->auth->authenticate($request);
                $this->auth->authorize($request->principal, $route[4], $route[5]);
            }
            if (isset($route[6]) && $route[6]) {
                $identity = $request->principal ? $request->principal['sub'] : $request->ip;
                $this->limiter->hit($route[2] . ':' . $identity, $route[6][0], $route[6][1]);
            } else {
                $this->limiter->hit('global:' . $request->ip, 100, 60);
            }
            $result = $this->controller->handle($route[2], $request);
            Response::success($result, isset($route[7]) ? $route[7] : 200);
        } catch (ApiException $error) {
            Response::error($error, $request ? $request->requestId : Uuid::v4());
        } catch (\Exception $error) {
            error_log(json_encode(array('level' => 'error', 'requestId' => $request ? $request->requestId : null, 'message' => $error->getMessage())));
            $message = $this->config->bool('APP_DEBUG') ? $error->getMessage() : 'ระบบไม่สามารถดำเนินการได้ กรุณาลองใหม่';
            Response::error(new ApiException(500, 'INTERNAL_SERVER_ERROR', $message), $request ? $request->requestId : Uuid::v4());
        }
        if ($request) {
            error_log(json_encode(array('method' => $request->method, 'path' => $request->path, 'status' => http_response_code(), 'durationMs' => round((microtime(true) - $started) * 1000), 'requestId' => $request->requestId, 'userId' => $request->principal ? $request->principal['sub'] : null)));
        }
    }

    private function route($method, $path, $action, $public, array $kinds, array $roles, $rate = null, $status = 200)
    {
        return array($method, $path, $action, $public, $kinds, $roles, $rate, $status);
    }

    private function routes()
    {
        $allAdmins = array('SUPER_ADMIN', 'SUPERVISOR', 'OFFICER', 'VIEWER');
        $manageAdmins = array('SUPER_ADMIN', 'SUPERVISOR');
        $operate = array('SUPER_ADMIN', 'SUPERVISOR', 'OFFICER');
        return array(
            $this->route('GET', '/health', 'health', true, array(), array()),
            $this->route('GET', '/ready', 'ready', true, array(), array()),
            $this->route('POST', '/auth/development-login', 'citizenDevelopmentLogin', true, array(), array(), array(10, 60), 201),
            $this->route('POST', '/auth/facebook', 'citizenFacebookLogin', true, array(), array(), array(10, 60), 201),
            $this->route('POST', '/auth/line', 'citizenLineLogin', true, array(), array(), array(10, 60), 201),
            $this->route('POST', '/auth/refresh', 'refresh', true, array(), array(), array(20, 60), 201),
            $this->route('POST', '/auth/logout', 'logout', true, array(), array(), null, 201),
            $this->route('GET', '/auth/me', 'citizenMe', false, array('citizen'), array()),
            $this->route('POST', '/admin/auth/login', 'adminLogin', true, array(), array(), array(5, 60), 201),
            $this->route('POST', '/admin/auth/refresh', 'refresh', true, array(), array(), array(20, 60), 201),
            $this->route('POST', '/admin/auth/logout', 'logout', true, array(), array(), null, 201),
            $this->route('GET', '/admin/auth/me', 'adminMe', false, array('admin'), $allAdmins),
            $this->route('PATCH', '/admin/auth/change-password', 'changePassword', false, array('admin'), $allAdmins),
            $this->route('POST', '/realtime/token', 'realtimeToken', false, array('admin', 'citizen'), array()),
            $this->route('POST', '/incidents', 'createIncident', false, array('citizen'), array(), array(20, 60), 201),
            $this->route('GET', '/incidents/me', 'citizenIncidents', false, array('citizen'), array()),
            $this->route('GET', '/incidents/me/{id}', 'citizenIncident', false, array('citizen'), array()),
            $this->route('GET', '/incidents/code/{caseCode}', 'citizenIncidentByCode', false, array('citizen'), array()),
            $this->route('GET', '/incidents/{id}', 'citizenIncident', false, array('citizen'), array()),
            $this->route('POST', '/incidents/{id}/images', 'uploadImages', false, array('citizen'), array(), array(10, 60), 201),
            $this->route('GET', '/admin/incidents', 'adminIncidents', false, array('admin'), $allAdmins),
            $this->route('GET', '/admin/incidents/map-points', 'mapPoints', false, array('admin'), $allAdmins),
            $this->route('GET', '/admin/incidents/{id}', 'adminIncident', false, array('admin'), $allAdmins),
            $this->route('PATCH', '/admin/incidents/{id}/accept', 'acceptIncident', false, array('admin'), $operate),
            $this->route('PATCH', '/admin/incidents/{id}/complete', 'completeIncident', false, array('admin'), $operate),
            $this->route('POST', '/admin/incidents/{id}/notes', 'addIncidentNote', false, array('admin'), $operate, null, 201),
            $this->route('GET', '/admin/dashboard/summary', 'dashboardSummary', false, array('admin'), $allAdmins),
            $this->route('GET', '/admin/dashboard/recent-incidents', 'dashboardRecent', false, array('admin'), $allAdmins),
            $this->route('GET', '/admin/dashboard/incidents-by-status', 'dashboardByStatus', false, array('admin'), $allAdmins),
            $this->route('GET', '/admin/dashboard/incidents-by-type', 'dashboardByType', false, array('admin'), $allAdmins),
            $this->route('GET', '/admin/dashboard/incidents-by-date', 'dashboardByDate', false, array('admin'), $allAdmins),
            $this->route('GET', '/admin/users', 'adminUsers', false, array('admin'), $manageAdmins),
            $this->route('POST', '/admin/users', 'createAdminUser', false, array('admin'), $manageAdmins, null, 201),
            $this->route('GET', '/admin/users/{id}', 'adminUser', false, array('admin'), $manageAdmins),
            $this->route('PATCH', '/admin/users/{id}', 'updateAdminUser', false, array('admin'), $manageAdmins),
            $this->route('PATCH', '/admin/users/{id}/status', 'updateAdminStatus', false, array('admin'), $manageAdmins),
            $this->route('DELETE', '/admin/users/{id}', 'deleteAdminUser', false, array('admin'), $manageAdmins),
            $this->route('POST', '/admin/users/{id}/reset-password', 'resetAdminPassword', false, array('admin'), $manageAdmins),
            $this->route('GET', '/admin/staff-positions', 'staffPositions', false, array('admin'), $manageAdmins),
            $this->route('POST', '/admin/staff-positions', 'createStaffPosition', false, array('admin'), $manageAdmins, null, 201),
            $this->route('GET', '/admin/audit-logs', 'auditLogs', false, array('admin'), $manageAdmins),
            $this->route('GET', '/admin/settings', 'settings', false, array('admin'), $allAdmins),
            $this->route('PATCH', '/admin/settings', 'updateSettings', false, array('admin'), array('SUPER_ADMIN')),
            $this->route('GET', '/notifications', 'notifications', false, array('admin', 'citizen'), array()),
            $this->route('GET', '/notifications/unread-count', 'unreadCount', false, array('admin', 'citizen'), array()),
            $this->route('PATCH', '/notifications/{id}/read', 'readNotification', false, array('admin', 'citizen'), array()),
            $this->route('PATCH', '/notifications/read-all', 'readAllNotifications', false, array('admin', 'citizen'), array()),
            $this->route('DELETE', '/notifications/{id}', 'deleteNotification', false, array('admin', 'citizen'), array()),
            $this->route('POST', '/devices/register', 'registerDevice', false, array('citizen'), array(), null, 201),
            $this->route('DELETE', '/devices/{id}', 'deleteDevice', false, array('citizen'), array())
        );
    }

    private function cors(Request $request)
    {
        $origin = $request->header('origin');
        $allowed = array_filter(array_map('trim', explode(',', $this->config->get('CORS_ORIGINS', ''))));
        if ($origin && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-Request-Id');
            header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        }
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        header('X-Request-Id: ' . $request->requestId);
    }
}
