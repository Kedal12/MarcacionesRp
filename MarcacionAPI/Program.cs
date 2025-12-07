using MarcacionAPI.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text;
using MarcacionAPI.Services;

// --- AÑADIDOS PARA RATE LIMITING ---
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Connections; // Para StatusCodes

// --- FIN AÑADIDOS ---

var builder = WebApplication.CreateBuilder(args);

// --- AÑADIDO: escuchar en todas las interfaces, puerto 5000 ---
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// --- Configuración de Servicios ---

// 1) DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2) CORS (Configuración permisiva para desarrollo)
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirTodo", policy =>
    {
        policy.AllowAnyOrigin()   // <--- ESTO ES LA CLAVE: Permite localhost:8081, IPs de red, etc.
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

//2.1) Inyección de dependencias para servicios
builder.Services.AddScoped<IAsistenciaService, AsistenciaService>();
//2.2) Inyección de dependencias para el nuevo servicio ResumenService
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

// --- Rate Limiter ---
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

// --- Pipeline HTTP ---
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();

app.UseRouting();

app.UseCors("PermitirTodo");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();