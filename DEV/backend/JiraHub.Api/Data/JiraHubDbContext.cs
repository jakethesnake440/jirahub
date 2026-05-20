using JiraHub.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiraHub.Api.Data;

public class JiraHubDbContext : DbContext
{
    public JiraHubDbContext(DbContextOptions<JiraHubDbContext> options) : base(options) { }

    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketComment> TicketComments => Set<TicketComment>();
    public DbSet<TicketCommentMention> TicketCommentMentions => Set<TicketCommentMention>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<ImportBatchError> ImportBatchErrors => Set<ImportBatchError>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.HasKey(x => x.TicketId);
            entity.HasIndex(x => x.TicketKey).IsUnique();
            entity.HasIndex(x => x.Platform);
            entity.HasIndex(x => x.Functionality);
            entity.HasIndex(x => x.BuildFixed);
            entity.HasIndex(x => x.LastImportedAt);

            entity.Property(x => x.TicketKey).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Platform).HasMaxLength(255);
            entity.Property(x => x.VersionFound).HasMaxLength(255);
            entity.Property(x => x.BuildFixed).HasMaxLength(255);
            entity.Property(x => x.Functionality).HasMaxLength(255);
        });

        modelBuilder.Entity<TicketComment>(entity =>
        {
            entity.HasKey(x => x.CommentId);
            entity.HasIndex(x => x.TicketId);
            entity.HasIndex(x => x.CreatedAt);
            entity.Property(x => x.CommentAuthorContact).HasMaxLength(255);
            entity.HasOne(x => x.Ticket)
                .WithMany(x => x.Comments)
                .HasForeignKey(x => x.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.CreatedByUser)
                .WithMany(x => x.Comments)
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(x => x.UserId);
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.Email);
            entity.Property(x => x.DisplayName).HasMaxLength(255).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(255).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(255);
            entity.Property(x => x.Role).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<TicketCommentMention>(entity =>
        {
            entity.HasKey(x => x.MentionId);
            entity.HasIndex(x => new { x.CommentId, x.MentionedUserId }).IsUnique();
            entity.HasOne(x => x.Comment)
                .WithMany(x => x.Mentions)
                .HasForeignKey(x => x.CommentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.MentionedUser)
                .WithMany()
                .HasForeignKey(x => x.MentionedUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ImportBatch>(entity =>
        {
            entity.HasKey(x => x.ImportBatchId);
            entity.HasIndex(x => x.UploadedAt);
            entity.Property(x => x.FileName).HasMaxLength(500).IsRequired();
            entity.Property(x => x.UploadedBy).HasMaxLength(255);
        });

        modelBuilder.Entity<ImportBatchError>(entity =>
        {
            entity.HasKey(x => x.ImportBatchErrorId);
            entity.HasOne(x => x.ImportBatch)
                .WithMany(x => x.Errors)
                .HasForeignKey(x => x.ImportBatchId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
