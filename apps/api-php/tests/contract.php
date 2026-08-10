<?php

$root = dirname(dirname(dirname(__DIR__)));
$spec = json_decode(file_get_contents($root . '/packages/api-spec/openapi.json'), true);
if (!is_array($spec) || !isset($spec['paths'])) {
    throw new RuntimeException('OpenAPI document is invalid');
}

$expected = array();
foreach ($spec['paths'] as $path => $operations) {
    foreach ($operations as $method => $operation) {
        if (in_array(strtoupper($method), array('GET', 'POST', 'PATCH', 'PUT', 'DELETE'), true)) {
            $expected[] = strtoupper($method) . ' ' . preg_replace('#^/api/v1#', '', $path);
        }
    }
}

$source = file_get_contents(dirname(__DIR__) . '/src/App.php');
preg_match_all("/\\\$this->route\\('([A-Z]+)', '([^']+)'/", $source, $matches, PREG_SET_ORDER);
$actual = array();
foreach ($matches as $match) {
    $actual[] = $match[1] . ' ' . $match[2];
}

sort($expected);
sort($actual);
$missing = array_values(array_diff($expected, $actual));
$unexpected = array_values(array_diff($actual, $expected));
if ($missing || $unexpected) {
    fwrite(STDERR, 'Missing PHP routes: ' . implode(', ', $missing) . PHP_EOL);
    fwrite(STDERR, 'Unexpected PHP routes: ' . implode(', ', $unexpected) . PHP_EOL);
    exit(1);
}

fwrite(STDOUT, 'OpenAPI/PHP route contract passed for ' . count($actual) . ' endpoints.' . PHP_EOL);
