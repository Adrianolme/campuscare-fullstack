-- CampusCare · script completo para MySQL 8 (generado con "npm run sql")
CREATE DATABASE IF NOT EXISTS campuscare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campuscare;
SET NAMES utf8mb4;

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

-- ===== Datos iniciales =====
INSERT INTO zonas (id,nombre,pos_x,pos_y) VALUES
  ('edA','Edificio A',0,0),
  ('edB','Edificio B',1,0),
  ('edC','Edificio C',2,0),
  ('labs','Laboratorios',0,1),
  ('bib','Biblioteca',1,1),
  ('caf','Cafetería',2,1);

INSERT INTO categorias (nombre,icono) VALUES
  ('Eléctrica','⚡'),
  ('Hidráulica','💧'),
  ('Mobiliario','🪑'),
  ('Equipo y red','📽️'),
  ('Climatización','❄️'),
  ('General','🛠️');

INSERT INTO tecnicos (id,nombre,rol,zona_id) VALUES
  ('t1','Luis','electricista','edA'),
  ('t2','Diego','electricista','edC'),
  ('t3','Marta','plomería','labs'),
  ('t4','Iván','mantenimiento general','edB'),
  ('t5','Sofía','equipo y climatización','caf');

INSERT INTO tecnico_especialidades (tecnico_id,categoria_id)
SELECT t.id, c.id FROM (
  SELECT 't1' AS tid, 'Eléctrica' AS cn
  UNION ALL
  SELECT 't2' AS tid, 'Eléctrica' AS cn
  UNION ALL
  SELECT 't3' AS tid, 'Hidráulica' AS cn
  UNION ALL
  SELECT 't4' AS tid, 'Mobiliario' AS cn
  UNION ALL
  SELECT 't4' AS tid, 'General' AS cn
  UNION ALL
  SELECT 't5' AS tid, 'Equipo y red' AS cn
  UNION ALL
  SELECT 't5' AS tid, 'Climatización' AS cn
) x JOIN tecnicos t ON t.id = x.tid JOIN categorias c ON c.nombre = x.cn;
