<?php

namespace Police\Api;

use PDO;
use PDOException;

final class Database
{
    private $pdo;

    public function __construct(Config $config)
    {
        $dsn = 'mysql:host=' . $config->get('DB_HOST') . ';port=' . $config->get('DB_PORT', '3306') . ';dbname=' . $config->get('DB_DATABASE') . ';charset=utf8mb4';
        $this->pdo = new PDO($dsn, $config->get('DB_USERNAME'), $config->get('DB_PASSWORD', ''), array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ));
        $this->pdo->exec("SET time_zone = '+00:00'");
        $this->pdo->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION'");
    }

    public function pdo()
    {
        return $this->pdo;
    }

    public function fetchOne($sql, array $params = array())
    {
        $statement = $this->execute($sql, $params);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    public function fetchAll($sql, array $params = array())
    {
        return $this->execute($sql, $params)->fetchAll();
    }

    public function execute($sql, array $params = array())
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return $statement;
    }

    public function transaction($callback)
    {
        $this->pdo->beginTransaction();
        try {
            $result = call_user_func($callback, $this);
            $this->pdo->commit();
            return $result;
        } catch (\Exception $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    public function assertTestDatabase()
    {
        $name = (string) $this->pdo->query('SELECT DATABASE()')->fetchColumn();
        if (substr($name, -5) !== '_test') {
            throw new PDOException('Destructive test operation requires a database ending in _test');
        }
    }
}
