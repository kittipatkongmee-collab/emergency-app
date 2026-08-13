import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:police_incident_mobile/core/api_gateway_cookie_interceptor.dart';

void main() {
  test(
    'stores the API gateway cookie and replays the same request once',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(() => server.close(force: true));

      var requestCount = 0;
      server.listen((request) async {
        requestCount += 1;
        await utf8.decoder.bind(request).join();

        if (request.headers.value(HttpHeaders.cookieHeader) == null) {
          request.response
            ..statusCode = HttpStatus.temporaryRedirect
            ..headers.set(
              HttpHeaders.locationHeader,
              'http://${server.address.host}:${server.port}${request.uri}',
            )
            ..headers.set(
              HttpHeaders.setCookieHeader,
              '__nxquid=test-cookie==0012; Path=/; HttpOnly',
            );
        } else {
          expect(
            request.headers.value(HttpHeaders.cookieHeader),
            '__nxquid=test-cookie==0012',
          );
          request.response
            ..statusCode = HttpStatus.created
            ..headers.contentType = ContentType.json
            ..write('{"success":true,"data":{"accessToken":"token"}}');
        }
        await request.response.close();
      });

      final dio = Dio(
        BaseOptions(
          baseUrl: 'http://${server.address.host}:${server.port}/api/v1',
          followRedirects: false,
        ),
      );
      dio.interceptors.add(ApiGatewayCookieInterceptor(dio));

      final response = await dio.post<dynamic>(
        '/auth/line',
        data: const {'idToken': 'id-token', 'nonce': 'nonce'},
      );

      expect(response.statusCode, HttpStatus.created);
      expect(requestCount, 2);
    },
  );

  test('does not replay a redirect to another origin', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    var requestCount = 0;
    server.listen((request) async {
      requestCount += 1;
      await utf8.decoder.bind(request).join();
      request.response
        ..statusCode = HttpStatus.temporaryRedirect
        ..headers.set(HttpHeaders.locationHeader, 'https://example.com/auth')
        ..headers.set(
          HttpHeaders.setCookieHeader,
          '__nxquid=must-not-be-forwarded; Path=/; HttpOnly',
        );
      await request.response.close();
    });

    final dio = Dio(
      BaseOptions(
        baseUrl: 'http://${server.address.host}:${server.port}',
        followRedirects: false,
      ),
    );
    dio.interceptors.add(ApiGatewayCookieInterceptor(dio));

    await expectLater(
      dio.post<dynamic>('/auth/line', data: const {'idToken': 'id-token'}),
      throwsA(isA<DioException>()),
    );
    expect(requestCount, 1);
  });

  test('clones multipart form data before replaying a 307 request', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    var requestCount = 0;
    var replayedBody = '';
    server.listen((request) async {
      requestCount += 1;
      final body = await latin1.decoder.bind(request).join();

      if (request.headers.value(HttpHeaders.cookieHeader) == null) {
        request.response
          ..statusCode = HttpStatus.temporaryRedirect
          ..headers.set(
            HttpHeaders.locationHeader,
            'http://${server.address.host}:${server.port}${request.uri}',
          )
          ..headers.set(
            HttpHeaders.setCookieHeader,
            '__nxquid=multipart-cookie; Path=/; HttpOnly',
          );
      } else {
        replayedBody = body;
        request.response
          ..statusCode = HttpStatus.created
          ..headers.contentType = ContentType.json
          ..write('{"success":true,"data":[]}');
      }
      await request.response.close();
    });

    final dio = Dio(
      BaseOptions(
        baseUrl: 'http://${server.address.host}:${server.port}',
        followRedirects: false,
      ),
    );
    dio.interceptors.add(ApiGatewayCookieInterceptor(dio));

    final form = FormData.fromMap({
      'files': MultipartFile.fromBytes(
        utf8.encode('test-image-content'),
        filename: 'incident.jpg',
        contentType: DioMediaType.parse('image/jpeg'),
      ),
    });
    final response = await dio.post<dynamic>('/images', data: form);

    expect(response.statusCode, HttpStatus.created);
    expect(requestCount, 2);
    expect(replayedBody, contains('incident.jpg'));
    expect(replayedBody, contains('test-image-content'));
  });

  test('replays a GET request after the gateway returns 302', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    var requestCount = 0;
    server.listen((request) async {
      requestCount += 1;
      if (request.headers.value(HttpHeaders.cookieHeader) == null) {
        request.response
          ..statusCode = HttpStatus.found
          ..headers.set(
            HttpHeaders.locationHeader,
            'http://${server.address.host}:${server.port}${request.uri}',
          )
          ..headers.set(
            HttpHeaders.setCookieHeader,
            '__nxquid=get-cookie; Path=/; HttpOnly',
          );
      } else {
        request.response
          ..statusCode = HttpStatus.ok
          ..headers.contentType = ContentType.json
          ..write('{"success":true,"data":{"status":"ok"}}');
      }
      await request.response.close();
    });

    final dio = Dio(
      BaseOptions(
        baseUrl: 'http://${server.address.host}:${server.port}',
        followRedirects: false,
      ),
    );
    dio.interceptors.add(ApiGatewayCookieInterceptor(dio));

    final response = await dio.get<dynamic>('/api/v1/health');

    expect(response.statusCode, HttpStatus.ok);
    expect(requestCount, 2);
  });
}
