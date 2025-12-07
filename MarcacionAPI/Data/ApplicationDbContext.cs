using MarcacionAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace MarcacionAPI.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    // --- DbSets ---
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // --- Usuario ---
        modelBuilder.Entity<Usuario>(e =>
        {
            // FK a Sede
            e.HasOne(u => u.Sede)
             .WithMany()
             .HasForeignKey(u => u.IdSede)
             .OnDelete(DeleteBehavior.Restrict);

            // Índice único por Email
            e.HasIndex(u => u.Email).IsUnique();

            // Evita que EF mapee/lea una columna sombra "HorarioId" en Usuarios
            e.Ignore("HorarioId");
        });

        // --- Marcacion ---
        modelBuilder.Entity<Marcacion>()
            .HasOne(m => m.Usuario)
            .WithMany()
            .HasForeignKey(m => m.IdUsuario)
            .OnDelete(DeleteBehavior.Restrict);

        // --- Sede (precisiones) ---
        modelBuilder.Entity<Sede>(entity =>
        {
            entity.Property(e => e.Lat).HasPrecision(9, 6);
            entity.Property(e => e.Lon).HasPrecision(10, 6);
        });

        // --- Marcacion (precisiones) ---
        modelBuilder.Entity<Marcacion>(entity =>
        {
            entity.Property(m => m.LatitudMarcacion).HasPrecision(9, 6);
            entity.Property(m => m.LongitudMarcacion).HasPrecision(10, 6);
        });

        // --- Auditoria ---
        modelBuilder.Entity<Auditoria>(entity =>
        {
            entity.ToTable("Auditoria");
            entity.Property(a => a.Fecha).HasDefaultValueSql("SYSDATETIMEOFFSET()");
        });

        // --- Horario ---
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

        // --- HorarioDetalle ---
        modelBuilder.Entity<HorarioDetalle>(entity =>
        {
            entity.HasIndex(d => new { d.IdHorario, d.DiaSemana }).IsUnique();

            // Fuerza el nombre de columna correcto en BD
            entity.Property(d => d.IdHorario).HasColumnName("IdHorario");

            entity.HasOne(d => d.Horario)
                  .WithMany(h => h.Detalles)
                  .HasForeignKey(d => d.IdHorario)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // --- UsuarioHorario ---
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
                  .WithMany(h => h.Asignaciones) // o .WithMany(h => h.UsuarioHorarios) si tienes la colección
                  .HasForeignKey(uh => uh.IdHorario)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // --- Feriado ---
        modelBuilder.Entity<Feriado>().HasKey(f => f.Fecha);

        // --- Ausencia ---
        modelBuilder.Entity<Ausencia>(entity =>
        {
            entity.HasOne(a => a.Usuario)
                  .WithMany()
                  .HasForeignKey(a => a.IdUsuario)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(a => new { a.IdUsuario, a.Desde, a.Hasta });
            entity.Property(a => a.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");
        });

        // --- Correccion ---
        modelBuilder.Entity<Correccion>(entity =>
        {
            entity.HasOne(c => c.Usuario)
                  .WithMany()
                  .HasForeignKey(c => c.IdUsuario)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(c => new { c.IdUsuario, c.Fecha });
            entity.Property(c => c.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");
        });

        modelBuilder.Entity<Marcacion>(e =>
        {
            e.Property(m => m.FechaHora)
             .HasColumnType("datetimeoffset(7)")
             .HasDefaultValueSql("SYSUTCDATETIME()");

            e.Property(m => m.InicioAlmuerzo).HasColumnType("datetimeoffset(7)");
            e.Property(m => m.FinAlmuerzo).HasColumnType("datetimeoffset(7)");
        });
    }
}