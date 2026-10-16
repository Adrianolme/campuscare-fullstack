-- CampusCare · esquema MySQL 8 (InnoDB, utf8mb4)
CREATE TABLE IF NOT EXISTS zonas (
  id      VARCHAR(10)  NOT NULL,
  nombre  VARCHAR(60)  NOT NULL,
  pos_x   TINYINT      NOT NULL,
  pos_y   TINYINT      NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categorias (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre  VARCHAR(40)  NOT NULL,
  icono   VARCHAR(8)   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tecnicos (
  id      VARCHAR(10)  NOT NULL,
  nombre  VARCHAR(60)  NOT NULL,
  rol     VARCHAR(60)  NOT NULL,
  zona_id VARCHAR(10)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_tecnicos_zona FOREIGN KEY (zona_id) REFERENCES zonas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tecnico_especialidades (
  tecnico_id   VARCHAR(10)  NOT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (tecnico_id, categoria_id),
  CONSTRAINT fk_te_tecnico   FOREIGN KEY (tecnico_id)   REFERENCES tecnicos (id) ON DELETE CASCADE,
  CONSTRAINT fk_te_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tickets (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio          VARCHAR(20)  NOT NULL,
  descripcion    VARCHAR(500) NOT NULL,
  categoria_id   INT UNSIGNED NOT NULL,
  severidad      ENUM('Baja','Media','Alta','Crítica') NOT NULL DEFAULT 'Media',
  zona_id        VARCHAR(10)  NOT NULL,
  espacio        VARCHAR(80)  NOT NULL DEFAULT '',
  ubicacion      VARCHAR(160) NOT NULL DEFAULT '',
  foto           MEDIUMTEXT   NULL,
  origen         ENUM('Reporte de usuario','Sensor IoT') NOT NULL DEFAULT 'Reporte de usuario',
  estado         TINYINT      NOT NULL DEFAULT 0,
  tecnico_id     VARCHAR(10)  NULL,
  motivo         VARCHAR(200) NOT NULL DEFAULT '',
  cliente_id     VARCHAR(64)  NOT NULL,
  creado_en      DATETIME     NOT NULL,
  actualizado_en DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_folio (folio),
  KEY ix_tickets_estado (estado),
  KEY ix_tickets_zona (zona_id),
  KEY ix_tickets_cliente (cliente_id),
  CONSTRAINT fk_tickets_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
  CONSTRAINT fk_tickets_zona      FOREIGN KEY (zona_id)      REFERENCES zonas (id),
  CONSTRAINT fk_tickets_tecnico   FOREIGN KEY (tecnico_id)   REFERENCES tecnicos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_historial (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id  INT UNSIGNED NOT NULL,
  estado     TINYINT      NOT NULL,
  nota       VARCHAR(200) NOT NULL DEFAULT '',
  creado_en  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY ix_historial_ticket (ticket_id),
  CONSTRAINT fk_historial_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alertas_sensor (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id  INT UNSIGNED NOT NULL,
  tipo       ENUM('energia','agua','temp') NOT NULL,
  valor      DECIMAL(10,2) NOT NULL,
  umbral     DECIMAL(10,2) NOT NULL,
  creado_en  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY ix_alertas_ticket (ticket_id),
  CONSTRAINT fk_alertas_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contactos (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(80)  NOT NULL,
  correo        VARCHAR(120) NOT NULL,
  rol           VARCHAR(40)  NOT NULL DEFAULT '',
  fecha_visita  DATE         NULL,
  calificacion  TINYINT      NULL,
  mensaje       VARCHAR(1000) NOT NULL,
  creado_en     DATETIME     NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(80)  NOT NULL,
  correo        VARCHAR(120) NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  rol           ENUM('admin','tecnico','usuario') NOT NULL DEFAULT 'usuario',
  tecnico_id    VARCHAR(10)  NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en     DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo),
  CONSTRAINT fk_usuarios_tecnico FOREIGN KEY (tecnico_id) REFERENCES tecnicos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sesiones (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash  CHAR(64)     NOT NULL,
  usuario_id  INT UNSIGNED NOT NULL,
  creado_en   DATETIME     NOT NULL,
  expira_en   DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesiones_token (token_hash),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;