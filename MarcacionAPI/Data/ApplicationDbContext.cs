using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using MarcacionAPI.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MarcacionAPI.Data;

public class ApplicationDbContext : DbContext
{
    public DbSet<Sede> Sedes { get; set; }
    public DbSet<Usuario> Usuarios { get; set; }
    public DbSet<Marcacion> Marcaciones { get; set; }
    public DbSet<Auditoria> Auditorias { get; set; }
    public DbSet<Horario> Horarios { get; set; }
    public DbSet<HorarioDetalle> HorarioDetalles { get; set; }
    public DbSet<UsuarioHorario> UsuarioHorarios { get; set; }
    public DbSet<Feriado> Feriados { get; set; }
    public DbSet<Ausencia> Ausencias { get; set; }
    public DbSet<Correccion> Correcciones { get; set; }
    
    // ✅ DbSet para LoginLogs (autenticación facial)
    public DbSet<LoginLog> LoginLogs { get; set; }

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ============================================================================
        // CONFIGURACIÓN DE USUARIO
        // ============================================================================
        modelBuilder.Entity<Usuario>(e =>
        {
            e.HasOne(u => u.Sede)
             .WithMany()
             .HasForeignKey(u => u.IdSede)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(u => u.Email).IsUnique();
            e.Ignore("HorarioId");
            
            // ✅ Configuración para columnas de autenticación facial
            e.Property(u => u.FotoPerfilPath)
             .HasMaxLength(500)
             .IsRequired(false);
            
            e.Property(u => u.FaceEmbedding)
             .HasColumnType("varbinary(max)")
             .IsRequired(false);
            
            // ✅ Índice para búsquedas por NumeroDocumento en login facial
            e.HasIndex(u => u.NumeroDocumento)
             .HasDatabaseName("IX_Usuarios_NumeroDocumento")
             .HasFilter("[Activo] = 1");
        });

        // ============================================================================
        // CONFIGURACIÓN DE MARCACIÓN
        // ============================================================================
        modelBuilder.Entity<Marcacion>(e =>
        {
            e.HasOne(m => m.Usuario)
             .WithMany()
             .HasForeignKey(m => m.IdUsuario)
             .OnDelete(DeleteBehavior.Restrict);

            e.Property(m => m.LatitudMarcacion).HasPrecision(9, 6);
            e.Property(m => m.LongitudMarcacion).HasPrecision(10, 6);

            e.Property(m => m.FechaHora)
             .HasColumnType("datetimeoffset(7)")
             .HasDefaultValueSql("SYSUTCDATETIME()");

            e.Property(m => m.InicioAlmuerzo).HasColumnType("datetimeoffset(7)");
            e.Property(m => m.FinAlmuerzo).HasColumnType("datetimeoffset(7)");
        });

        // ============================================================================
        // CONFIGURACIÓN DE SEDE
        // ============================================================================
        modelBuilder.Entity<Sede>(entity =>
        {
            entity.Property(e => e.Lat).HasPrecision(9, 6);
            entity.Property(e => e.Lon).HasPrecision(10, 6);
        });

        // ============================================================================
        // CONFIGURACIÓN DE AUDITORIA
        // ============================================================================
        modelBuilder.Entity<Auditoria>(entity =>
        {
            entity.ToTable("Auditoria");
            entity.Property(a => a.Fecha).HasDefaultValueSql("SYSDATETIMEOFFSET()");
        });

        // ============================================================================
        // CONFIGURACIÓN DE HORARIO Y DETALLE
        // ============================================================================
        modelBuilder.Entity<Horario>(entity =>
        {
            entity.HasIndex(h => h.Nombre).IsUnique(false);
            entity.HasMany(h => h.Detalles)
                  .WithOne(d => d.Horario)
                  .HasForeignKey(d => d.IdHorario)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(h => h.Sede)
                  .WithMany()
                  .HasForeignKey(h => h.IdSede)
                  .IsRequired(false)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<HorarioDetalle>(entity =>
        {
            entity.HasIndex(d => new { d.IdHorario, d.DiaSemana }).IsUnique();
            entity.Property(d => d.IdHorario).HasColumnName("IdHorario");
        });

        // ============================================================================
        // CONFIGURACIÓN DE USUARIO-HORARIO (ASIGNACIONES)
        // ============================================================================
        modelBuilder.Entity<UsuarioHorario>(entity =>
        {
            entity.HasIndex(uh => new { uh.IdUsuario, uh.Desde, uh.Hasta });
            entity.Property(uh => uh.IdUsuario).HasColumnName("IdUsuario");
            entity.Property(uh => uh.IdHorario).HasColumnName("IdHorario");

            entity.HasOne(uh => uh.Usuario)
                  .WithMany()
                  .HasForeignKey(uh => uh.IdUsuario)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(uh => uh.Horario)
                  .WithMany(h => h.Asignaciones)
                  .HasForeignKey(uh => uh.IdHorario)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ============================================================================
        // CONFIGURACIÓN DE FERIADO
        // ============================================================================
        modelBuilder.Entity<Feriado>().HasKey(f => f.Fecha);

        // ============================================================================
        // CONFIGURACIÓN DE AUSENCIA
        // ============================================================================
        modelBuilder.Entity<Ausencia>(entity =>
        {
            entity.HasOne(a => a.Usuario)
                  .WithMany()
                  .HasForeignKey(a => a.IdUsuario)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(a => new { a.IdUsuario, a.Desde, a.Hasta });
            entity.Property(a => a.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");
        });

        // ============================================================================
        // CONFIGURACIÓN DE CORRECCIÓN
        // ============================================================================
        modelBuilder.Entity<Correccion>(entity =>
        {
            entity.HasOne(c => c.Usuario)
                  .WithMany()
                  .HasForeignKey(c => c.IdUsuario)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(c => new { c.IdUsuario, c.Fecha });
            entity.Property(c => c.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");
        });

        // ============================================================================
        // CONFIGURACIÓN DE LOGINLOG (AUTENTICACIÓN FACIAL)
        // ============================================================================
        modelBuilder.Entity<LoginLog>(entity =>
        {
            entity.ToTable("LoginLogs");
            entity.HasKey(e => e.Id);
            
            // Configuración de la columna Confianza (precisión decimal)
            entity.Property(e => e.Confianza)
                .HasColumnType("decimal(5,4)")
                .IsRequired();
            
            // Configuración de FechaHora con valor por defecto
            entity.Property(e => e.FechaHora)
                .HasColumnType("datetimeoffset(7)")
                .HasDefaultValueSql("SYSDATETIMEOFFSET()")
                .IsRequired();
            
            // Relación con Usuario
            entity.HasOne(e => e.Usuario)
                .WithMany()
                .HasForeignKey(e => e.IdUsuario)
                .OnDelete(DeleteBehavior.Restrict);
            
            // ✅ Índice compuesto para consultas de intentos fallidos
            entity.HasIndex(e => new { e.IdUsuario, e.FechaHora })
                .HasDatabaseName("IX_LoginLogs_IdUsuario_FechaHora");
            
            // ✅ Índice para consultas por estado de éxito
            entity.HasIndex(e => e.Exitoso)
                .HasDatabaseName("IX_LoginLogs_Exitoso");
        });
    }
}
