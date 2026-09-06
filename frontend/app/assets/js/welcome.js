
// Add new releases or change records here; the table is generated automatically.
const releases = [
  {
    version: "4.0",
    releaseDate: "Mevcut sürüm",
    changes: [
      {
        type: "yeni özellik",
        description: "Ekşi Sözlük'ün alan adının engellenmesi nedeniyle alınan önlemler kaldırıldı; böylece artık gereksiz olan geniş izinler de kaldırılmış oldu."
      },
      {
        type: "yeni özellik",
        description: "Tüm arayüz yeniden tasarlandı."
      },
      {
        type: "bug fix",
        description: "Tüm engelleri kaldırma (undobanall) fonksiyonunun düzgün çalışmaması sorunu giderildi."
      }
    ]
  },
  {
    version: "3.2",
    releaseDate: "09.04.2024",
    changes: [
      {
        type: "bug fix",
        description: "Ekşi Engel sunucusu taşındığı için URL adresleri güncel değildi."
      }
    ]
  },
  {
    version: "3.1",
    releaseDate: "03.03.2024",
    changes: [
      {
        type: "yeni özellik",
        description: "Bir başlıkta yazısı olan herkesi engelleme özelliği eklendi. Son 24 saatte yazanlar ve tümü olmak üzere iki ayrı seçenek mevcut."
      }
    ]
  },
  {
    version: "3.0",
    releaseDate: "17.09.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Başlıklarını engelle ayarı eklendi. Önceden varsayılan olarak uygulanıyordu ve kapatmak mümkün değildi."
      },
      {
        type: "yeni özellik",
        description: "Anonim veri gönderme özelliği iptal edildi."
      }
    ]
  },
  {
    version: "2.7",
    releaseDate: "06.06.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Yeşil ve sarı tikleri gizleme özelliği eklendi; yalnızca tikler gizlenir."
      },
      {
        type: "yeni özellik",
        description: "Devam eden süreçle ilgili daha fazla bilgi notification.html üzerinden gösterilmeye başlandı."
      },
      {
        type: "yeni özellik",
        description: "Bir Ekşi Engel butonuna tıklandığında kullanıcıya Ekşi Sözlük API'si üzerinden geri bildirim verilmeye başlandı."
      },
      {
        type: "yeni özellik",
        description: "Analitik verilerin toplanması durduruldu."
      },
      {
        type: "bug fix",
        description: "Kuyruğa eklenen işlemlerin saat bilgisi düzeltildi."
      }
    ]
  },
  {
    version: "2.6",
    releaseDate: "21.05.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Ekşi Sözlük ikinci kez engellendi ve eksisozluk1923.com alan adına taşındı. Sık yaşanan alan adı değişiklikleri, güncel adresin Ekşi Engel sunucularından alınmasıyla çözüldü."
      },
      {
        type: "yeni özellik",
        description: "Favori ve takipçi engelleme işlemleri için takip ettiğim kullanıcıları yanlışlıkla engelleme ayarı eklendi."
      },
      {
        type: "yeni özellik",
        description: "Favori ve takipçi engelleme işlemlerinde yalnızca gereken işlemleri yaparak toplam işlem sayısını ve geçen zamanı azaltan ayar eklendi. Tüm engelleri kaldırma işlemi zaten bu şekilde çalışıyordu."
      },
      {
        type: "yeni özellik",
        description: "Yazar profil sayfasına takipçilerini engelle butonu eklendi."
      },
      {
        type: "yeni özellik",
        description: "Sayfalardaki footer kaldırıldı."
      }
    ]
  },
  {
    version: "2.5",
    releaseDate: "06.04.2023",
    changes: [
      {
        type: "bug fix",
        description: "Ekşi Engel'in, Ekşi Sözlük'ün mahkeme kararıyla engellenmesi üzerine geçtiği eksisozluk2023.com alan adında çalışması sağlandı."
      }
    ]
  },
  {
    version: "2.4",
    releaseDate: "28.03.2023",
    changes: [
      {
        type: "bug fix",
        description: "Ekşi Sözlük tarafından taşıma yetkisi verilen kullanıcıların entry menüsünü düzgün görememesine neden olan hata giderildi."
      }
    ]
  },
  {
    version: "2.3",
    releaseDate: "23.03.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Bir yazarı takip eden herkesi engelleme butonu eklendi."
      },
      {
        type: "yeni özellik",
        description: "Eklenti menüsündeki bazı butonlar Ekşi Sözlük arayüzüne taşındı."
      },
      {
        type: "yeni özellik",
        description: "Bazı analitik veriler toplanmaya başlandı."
      },
      {
        type: "bug fix",
        description: "Başka bir engelleme işlemi devam ederken cooldown sürecinde arayüzdeki butonların çalışmaması, alternatif butonların yazar menüsüne eklenip işlemlerin kuyruğa alınmasıyla çözüldü."
      }
    ]
  },
  {
    version: "2.2",
    releaseDate: "06.03.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Engelle veya sessize al tercihi ayar menüsüne eklendi."
      },
      {
        type: "yeni özellik",
        description: "Çaylakları da engelleme tercihi ayar menüsüne eklendi."
      },
      {
        type: "yeni özellik",
        description: "Tüm yazarların engelini kaldırma işlemi optimize edilerek süreç hızlandırıldı."
      },
      {
        type: "bug fix",
        description: "Yükleme ve güncellemeden sonra geriye dönük uyumluluk sağlanamadığı için eklenti ayarlarının sıfırlanması sağlandı."
      }
    ]
  },
  {
    version: "2.1",
    releaseDate: "02.03.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Ekşi Sözlük tarafından engelleme hızına limit getirildiği için işlemlere cooldown süresi eklendi. Mevcut limitler dakikada 6 engelleme ve 10 engel kaldırmadır."
      },
      {
        type: "yeni özellik",
        description: "Uzun süren işlemler için işlem kuyruğu geliştirildi; devam eden bir işlem sırasında başlatılan yeni işlemler sıraya alınıyor."
      },
      {
        type: "yeni özellik",
        description: "Devam eden engelleme işleminin cooldown ve kuyruk bilgileri yeni açılan sekmelerde görüntülenebilir hale getirildi."
      },
      {
        type: "bug fix",
        description: "Ekşi Sözlük güncellemesi nedeniyle bozulan tüm engelleri kaldırma özelliği düzeltildi."
      }
    ]
  },
  {
    version: "2.0",
    releaseDate: "19.11.2022",
    changes: [
      {
        type: "yeni özellik",
        description: "Engelleme ve engeli kaldırma işlemleri hızlandırıldı; tüm işlemler arka planda gerçekleşmeye başladı."
      }
    ]
  },
  {
    version: "1.3",
    releaseDate: "14.11.2022",
    changes: [
      {
        type: "yeni özellik",
        description: "Tüm kullanıcıların engelini kaldırma özelliği eklendi."
      },
      {
        type: "yeni özellik",
        description: "Engelleme ve engeli kaldırma işlemleri hızlandırıldı."
      },
      {
        type: "yeni özellik",
        description: "Kullanıcının Ekşi Sözlük kullanıcı adı ve engellediği yazarların isimleri toplanmaya ve işlenmeye başlandı. Veri toplama ayarlardan kapatılabilir hale getirildi."
      },
      {
        type: "bug fix",
        description: "URL yönlendirmenin zaman zaman çalışmaması sorunu düzeltildi."
      }
    ]
  },
  {
    version: "1.2",
    releaseDate: "27.09.2022",
    changes: [
      {
        type: "yeni özellik",
        description: "Bir entry'yi favorileyen yazarları engelleme özelliği eklendi."
      },
      {
        type: "yeni özellik",
        description: "Arayüz sadeleştirildi."
      },
      {
        type: "bug fix",
        description: "Adblocker gibi sayfaya müdahale eden eklentilerin neden olduğu sorunlar giderildi."
      },
      {
        type: "bug fix",
        description: "Engelleme devam ederken sayfa kapatıldığında uygulamanın çökmesi engellendi."
      },
      {
        type: "bug fix",
        description: "Kullanıcı adında boşluk bulunan yazarların engellenememesi sorunu çözüldü."
      }
    ]
  },
  {
    version: "1.1",
    releaseDate: "09.05.2022",
    changes: [
      {
        type: "bug fix",
        description: "Market sayfasındaki görseller güncellendi."
      }
    ]
  },
  {
    version: "1.0",
    releaseDate: "06.05.2022",
    changes: [
      {
        type: "yeni özellik",
        description: "Kullanıcıdan alınan listedeki yazarları engelleme özelliği eklendi."
      }
    ]
  }
];

function createRow(label, value) {
  const row = document.createElement("tr");
  const labelCell = document.createElement("td");
  const valueCell = document.createElement("td");

  labelCell.textContent = `${label}:`;
  valueCell.textContent = value;
  row.append(labelCell, valueCell);

  return row;
}

function createVersionHeader(version, releaseDate) {
  const row = document.createElement("tr");
  const cell = document.createElement("th");
  const heading = document.createElement("div");
  const versionLabel = document.createElement("span");
  const dateLabel = document.createElement("span");

  row.className = "release-version";
  cell.colSpan = 2;
  cell.scope = "rowgroup";
  versionLabel.className = "release-version-number";
  versionLabel.textContent = `Sürüm ${version}`;
  dateLabel.className = "release-date";
  dateLabel.textContent = releaseDate ? `Yayın: ${releaseDate}` : "Yayın tarihi belirtilmedi";
  heading.className = "release-version-heading";
  heading.append(versionLabel, dateLabel);
  cell.append(heading);
  row.append(cell);

  return row;
}

function renderReleaseNotes(releaseList) {
  const table = document.getElementById("releaseNotes");
  const releaseGroups = document.createDocumentFragment();

  releaseList.forEach((release) => {
    const group = document.createElement("tbody");
    group.className = "release-group";
    group.append(createVersionHeader(release.version, release.releaseDate));

    release.changes.forEach((change) => {
      group.append(createRow(change.type, change.description));
    });

    releaseGroups.append(group);
  });

  table.replaceChildren(releaseGroups);
}

document.addEventListener('DOMContentLoaded', function () {
  renderReleaseNotes(releases);
});


