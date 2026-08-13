import 'package:dio/dio.dart';

/// Handles the cookie challenge placed in front of the production API.
///
/// The gateway responds to the first request with a 302/307 redirect to the
/// exact same URL and a short-lived `__nxquid` cookie. Dio does not retain cookies
/// from intermediate redirects by default, so the request would otherwise
/// loop until it fails. This interceptor accepts only that named cookie and
/// replays a request once, only to the same origin and URL.
final class ApiGatewayCookieInterceptor extends Interceptor {
  ApiGatewayCookieInterceptor(this._dio);

  static const _retryKey = 'retriedAfterApiGatewayCookie';
  static final _gatewayCookiePattern = RegExp(
    r'(?:^|[;,]\s*)(__nxquid=[^;,\s]+)',
  );

  final Dio _dio;
  String? _gatewayCookie;
  String? _gatewayHost;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final cookie = _gatewayCookie;
    if (cookie != null && options.uri.host == _gatewayHost) {
      final existing = options.headers['Cookie']?.toString().trim();
      final alreadyAttached = existing
          ?.split(';')
          .any((value) => value.trim().startsWith('__nxquid='));
      if (alreadyAttached != true) {
        options.headers['Cookie'] = existing == null || existing.isEmpty
            ? cookie
            : '$existing; $cookie';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    final cookie = _cookieForSameUrlRedirect(err);
    if (cookie == null || options.extra[_retryKey] == true) {
      handler.next(err);
      return;
    }

    _gatewayCookie = cookie;
    _gatewayHost = options.uri.host;
    options.extra[_retryKey] = true;
    options.headers['Cookie'] = cookie;
    if (options.data case final FormData formData) {
      options.data = formData.clone();
    }

    try {
      handler.resolve(await _dio.fetch<dynamic>(options));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  String? _cookieForSameUrlRedirect(DioException error) {
    final response = error.response;
    final statusCode = response?.statusCode;
    final method = error.requestOptions.method.toUpperCase();
    final canReplay =
        statusCode == 307 ||
        (statusCode == 302 && (method == 'GET' || method == 'HEAD'));
    if (!canReplay) return null;

    final original = error.requestOptions.uri;
    final location = response!.headers.value('location');
    if (location == null || location.trim().isEmpty) return null;

    final redirected = original.resolve(location);
    if (redirected.scheme != original.scheme ||
        redirected.host != original.host ||
        redirected.port != original.port ||
        redirected.path != original.path ||
        redirected.query != original.query) {
      return null;
    }

    for (final value in response.headers['set-cookie'] ?? const []) {
      final match = _gatewayCookiePattern.firstMatch(value);
      if (match != null) return match.group(1);
    }
    return null;
  }
}
