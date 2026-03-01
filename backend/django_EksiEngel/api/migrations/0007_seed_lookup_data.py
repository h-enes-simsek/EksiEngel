from django.db import migrations


def create_lookup_data(apps, schema_editor):
    BanSource = apps.get_model("api", "BanSource")
    BanMode = apps.get_model("api", "BanMode")
    TargetType = apps.get_model("api", "TargetType")
    ClickSource = apps.get_model("api", "ClickSource")
    LogLevel = apps.get_model("api", "LogLevel")
    TimeSpecifier = apps.get_model("api", "TimeSpecifier")

    ban_sources = [
        "SINGLE",
        "FAV",
        "FOLLOW",
        "LIST",
        "UNDOBANALL",
        "TITLE",
        "BLOCKED_MUTED_TITLES",
        "MIGRATE_BLOCKED_TO_MUTED",
        "BLOCK_MUTED_USERS",
        "REFRESH_MUTED_LIST",
        "REFRESH_BLOCKED_LIST",
        "DATE_BASED_BULK",
        "UNMUTEALL",
        "REFRESH_FOLLOWED_LIST",
    ]
    for i, val in enumerate(ban_sources, 1):
        BanSource.objects.get_or_create(pk=i, defaults={"ban_source": val})

    ban_modes = ["BAN", "UNDOBAN"]
    for i, val in enumerate(ban_modes, 1):
        BanMode.objects.get_or_create(pk=i, defaults={"ban_mode": val})

    target_types = ["USER", "TITLE", "MUTE", "FOLLOW"]
    for i, val in enumerate(target_types, 1):
        TargetType.objects.get_or_create(pk=i, defaults={"target_type": val})

    click_sources = ["ENTRY", "PROFILE", "QUESTION", "FOLLOWING", "FOLLOWER", "TITLE"]
    for i, val in enumerate(click_sources, 1):
        ClickSource.objects.get_or_create(pk=i, defaults={"click_source": val})

    log_levels = ["DEBUG", "INFO", "WARNING", "ERROR"]
    for i, val in enumerate(log_levels, 1):
        LogLevel.objects.get_or_create(pk=i, defaults={"log_level": val})

    time_specifiers = ["LAST_24_H", "LAST_1_W", "LAST_1_M", "LAST_3_M", "ALL"]
    for i, val in enumerate(time_specifiers, 1):
        TimeSpecifier.objects.get_or_create(pk=i, defaults={"time_specifier": val})


def remove_lookup_data(apps, schema_editor):
    BanSource = apps.get_model("api", "BanSource")
    BanMode = apps.get_model("api", "BanMode")
    TargetType = apps.get_model("api", "TargetType")
    ClickSource = apps.get_model("api", "ClickSource")
    LogLevel = apps.get_model("api", "LogLevel")
    TimeSpecifier = apps.get_model("api", "TimeSpecifier")

    BanSource.objects.all().delete()
    BanMode.objects.all().delete()
    TargetType.objects.all().delete()
    ClickSource.objects.all().delete()
    LogLevel.objects.all().delete()
    TimeSpecifier.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0006_action_bulk_action_action_date_criteria_and_more"),
    ]

    operations = [migrations.RunPython(create_lookup_data, remove_lookup_data)]
