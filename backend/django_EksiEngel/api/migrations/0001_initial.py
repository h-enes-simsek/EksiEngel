# Generated by Django 4.1.3 on 2023-09-14 13:24

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Action',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateTimeField(auto_now_add=True)),
                ('version', models.CharField(max_length=16)),
                ('user_agent', models.CharField(max_length=1024)),
                ('author_list_size', models.IntegerField()),
                ('total_action', models.IntegerField()),
                ('successful_action', models.IntegerField()),
                ('is_early_stopped', models.BooleanField()),
                ('log', models.CharField(blank=True, max_length=1000000, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='BanMode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ban_mode', models.CharField(max_length=10)),
            ],
        ),
        migrations.CreateModel(
            name='BanSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ban_source', models.CharField(max_length=10)),
            ],
        ),
        migrations.CreateModel(
            name='ClickSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('click_source', models.CharField(max_length=10)),
            ],
        ),
        migrations.CreateModel(
            name='ClickType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('click_type', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='EksiSozlukTitle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('eksisozluk_name', models.CharField(max_length=96)),
                ('eksisozluk_id', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='EksiSozlukUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('eksisozluk_name', models.CharField(max_length=96)),
                ('eksisozluk_id', models.IntegerField()),
                ('is_eksiengel_user', models.BooleanField()),
                ('first_activity_date', models.DateTimeField(blank=True, null=True)),
                ('last_activity_date', models.DateTimeField(blank=True, null=True)),
                ('last_activity_user_agent', models.CharField(blank=True, max_length=1024, null=True)),
                ('last_activity_version', models.CharField(blank=True, max_length=16, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='LogLevel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('log_level', models.CharField(max_length=10)),
            ],
        ),
        migrations.CreateModel(
            name='TargetType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('target_type', models.CharField(max_length=10)),
            ],
        ),
        migrations.CreateModel(
            name='EksiSozlukEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('eksisozluk_id', models.IntegerField()),
                ('eksisozluk_title', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='api.eksisozluktitle')),
            ],
        ),
        migrations.CreateModel(
            name='ActionConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('eksi_sozluk_url', models.CharField(max_length=100)),
                ('send_data', models.BooleanField(blank=True, null=True)),
                ('send_client_name', models.BooleanField(blank=True, null=True)),
                ('enable_noob_ban', models.BooleanField(blank=True, null=True)),
                ('enable_mute', models.BooleanField(blank=True, null=True)),
                ('enable_title_ban', models.BooleanField(blank=True, null=True)),
                ('enable_anaylsis_before_operations', models.BooleanField(blank=True, null=True)),
                ('enable_only_required_actions', models.BooleanField(blank=True, null=True)),
                ('enable_protect_followed_users', models.BooleanField(blank=True, null=True)),
                ('ban_premium_icons', models.BooleanField(blank=True, null=True)),
                ('action', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='action_config', to='api.action')),
            ],
        ),
        migrations.AddField(
            model_name='action',
            name='author_list',
            field=models.ManyToManyField(related_name='author_list_in_action', to='api.eksisozlukuser'),
        ),
        migrations.AddField(
            model_name='action',
            name='ban_mode',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='api.banmode'),
        ),
        migrations.AddField(
            model_name='action',
            name='ban_source',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='api.bansource'),
        ),
        migrations.AddField(
            model_name='action',
            name='click_source',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='api.clicksource'),
        ),
        migrations.AddField(
            model_name='action',
            name='eksi_engel_user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='eksi_engel_user_in_action', to='api.eksisozlukuser'),
        ),
        migrations.AddField(
            model_name='action',
            name='fav_author',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='fav_author_in_action', to='api.eksisozlukuser'),
        ),
        migrations.AddField(
            model_name='action',
            name='fav_entry',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='api.eksisozlukentry'),
        ),
        migrations.AddField(
            model_name='action',
            name='fav_title',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='api.eksisozluktitle'),
        ),
        migrations.AddField(
            model_name='action',
            name='log_level',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='api.loglevel'),
        ),
        migrations.AddField(
            model_name='action',
            name='target_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='api.targettype'),
        ),
    ]
