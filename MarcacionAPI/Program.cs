using MarcacionAPI.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text;
using MarcacionAPI.Services;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);

// Escuchar en todas las interfaces, puerto 5000
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// --- Configuración de Servicios ---

// 1) DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2) CORS: Política "PermitirTodo" para que React conecte sin problemas
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirTodo", policy =>
    {
        policy.AllowAnyOrigin()   // Permite cualquier IP (React, Celular, etc.)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// 2.1) Compresión de respuestas
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

// 2.2) Inyección de dependencias
builder.Services.AddScoped<IAsistenciaService, AsistenciaService>();
builder.Services.AddScoped<IResumenService, ResumenService>();

// 3) Auth JWT
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    builder.Configuration["Jwt:Key"]
                    ?? throw new InvalidOperationException("JWT Key not configured")
                )
            ),
            RoleClaimType = ClaimTypes.Role
        };
    });

builder.Logging.AddConsole();

// 4) Autorización
builder.Services.AddAuthorization();

// 5) Controllers
builder.Services.AddControllers();

// 6) Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "MarcacionAPI", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Introduce tu token JWT (con o sin prefijo 'Bearer ')."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
     {
       new OpenApiSecurityScheme {
         Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
       },
       Array.Empty<string>()
     }
    });
});

// 7) Rate Limiter
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter(policyName: "loginPolicy", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// --- Construcción de la App ---
var app = builder.Build();

// --- Pipeline HTTP (ORDEN CORRECTO) ---

// ⚠️ CAMBIO IMPORTANTE: Swagger fuera del "if Development" para verlo en IIS
app.UseSwagger();
app.UseSwaggerUI();

// 1. Compresión
app.UseResponseCompression();

// 2. CORS (Vital: Debe ir antes de Routing y Auth)
app.UseCors("PermitirTodo");

// 3. Routing
app.UseRouting();

// 4. Rate Limiter
app.UseRateLimiter();

// 5. Autenticación y Autorización
app.UseAuthentication();
app.UseAuthorization();

// 6. Controllers
app.MapControllers();

app.Run();