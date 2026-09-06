
// Add new releases or change records here; the table is generated automatically.
const releases = [
  {
    version: "4.0",
    releaseDate: "mevcut sürüm",
    changes: [
      {
        type: "yeni özellik",
        description: "Eklentinin tüm arayüzü baştan tasarlandı."
      },
      {
        type: "yeni özellik",
        description: "Eklenti güncellendiğinde kullanıcı ayarlarının korunması sağlandı."
      },
      {
        type: "yeni özellik",
        description: "Yazar sayfasında \"daha fazla göster\" seçeneğiyle yüklenen yeni entry'lere Ekşi Engel butonlarının eklenmesi sağlandı."
      },
      {
        type: "yeni özellik",
        description: "Ekşi Sözlük'ün alan adına uygulanan erişim engeli için geliştirilen geçici çözüm artık gerekli olmadığı için kaldırıldı. Eklentinin erişim izinleri sınırlandırıldı."
      },
      {
        type: "hata düzeltmesi",
        description: "Sırada bekleyen işlemlerin sonradan değiştirilen yazar listesini veya ayarları kullanması önlendi."
      }
    ]
  },
  {
    version: "3.2",
    releaseDate: "09.04.2024",
    changes: [
      {
        type: "hata düzeltmesi",
        description: "Ekşi Engel sunucusunun taşınmasının ardından güncelliğini yitiren sunucu adresleri yenilendi."
      }
    ]
  },
  {
    version: "3.1",
    releaseDate: "03.03.2024",
    changes: [
      {
        type: "yeni özellik",
        description: "Bir başlıkta entry'si bulunan yazarları topluca engelleme özelliği eklendi. Son 24 saatte yazanlar veya tüm yazarlar seçilebiliyor."
      }
    ]
  },
  {
    version: "3.0",
    releaseDate: "17.09.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Engellenen yazarların başlıklarını da engelleme ayarı eklendi. Önceden bu işlem varsayılan olarak uygulanıyor ve kapatılamıyordu."
      },
      {
        type: "yeni özellik",
        description: "Anonim veri gönderme seçeneği kaldırıldı."
      }
    ]
  },
  {
    version: "2.7",
    releaseDate: "06.06.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Yeşil ve sarı tikleri gizleme seçeneği eklendi. Bu seçenek yalnızca tikleri gizler."
      },
      {
        type: "yeni özellik",
        description: "İşlem durumu sayfasında devam eden süreç hakkında daha ayrıntılı bilgi gösterilmeye başlandı."
      },
      {
        type: "yeni özellik",
        description: "Ekşi Sözlük arayüzündeki bir Ekşi Engel butonuna basıldığında işlemin sıraya alındığını bildiren geri bildirim eklendi."
      },
      {
        type: "yeni özellik",
        description: "Analitik verilerin toplanması durduruldu."
      },
      {
        type: "hata düzeltmesi",
        description: "Sıraya eklenen işlemlerin saat bilgisi düzeltildi."
      }
    ]
  },
  {
    version: "2.6",
    releaseDate: "21.05.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Ekşi Sözlük'ün eksisozluk1923.com alan adına taşınması desteklendi. Sık yaşanan alan adı değişikliklerine uyum sağlamak için güncel adres Ekşi Engel sunucusundan alınmaya başlandı."
      },
      {
        type: "yeni özellik",
        description: "Favorileyenleri ve takipçileri engelleme işlemlerinde, takip ettiğiniz yazarları koruyan bir ayar eklendi."
      },
      {
        type: "yeni özellik",
        description: "Favorileyenleri ve takipçileri engelleme işlemlerinde yalnızca gerekli adımları uygulayarak işlem süresini kısaltan bir ayar eklendi. Tüm engelleri kaldırma özelliği zaten bu şekilde çalışıyordu."
      },
      {
        type: "yeni özellik",
        description: "Yazar profil sayfasına, yazarın takipçilerini engelleme butonu eklendi."
      },
      {
        type: "yeni özellik",
        description: "Eklenti sayfalarındaki alt bilgi bölümleri kaldırıldı."
      }
    ]
  },
  {
    version: "2.5",
    releaseDate: "06.04.2023",
    changes: [
      {
        type: "hata düzeltmesi",
        description: "Ekşi Engel'in, Ekşi Sözlük'ün erişim engelinin ardından kullanmaya başladığı eksisozluk2023.com alan adında çalışması sağlandı."
      }
    ]
  },
  {
    version: "2.4",
    releaseDate: "28.03.2023",
    changes: [
      {
        type: "hata düzeltmesi",
        description: "Ekşi Sözlük tarafından entry taşıma yetkisi verilen kullanıcıların entry menüsünü düzgün görememesine neden olan sorun giderildi."
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
        type: "hata düzeltmesi",
        description: "Başka bir engelleme işlemi devam ederken bekleme süresi nedeniyle kullanılamayan Ekşi Engel butonları, işlemleri sıraya alacak şekilde yenilendi."
      }
    ]
  },
  {
    version: "2.2",
    releaseDate: "06.03.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Yazarları engelleme veya sessize alma seçeneği ayarlar menüsüne eklendi."
      },
      {
        type: "yeni özellik",
        description: "Çaylak yazarları da engelleme tercihi ayarlar menüsüne eklendi."
      },
      {
        type: "yeni özellik",
        description: "Tüm yazarların engelini kaldırma işlemi optimize edilerek hızlandırıldı."
      },
      {
        type: "hata düzeltmesi",
        description: "Geriye dönük uyumluluk sorunlarını önlemek için eklenti yüklendiğinde veya güncellendiğinde ayarların sıfırlanması sağlandı."
      }
    ]
  },
  {
    version: "2.1",
    releaseDate: "02.03.2023",
    changes: [
      {
        type: "yeni özellik",
        description: "Ekşi Sözlük'ün getirdiği hız sınırına uyum sağlamak için işlemlere bekleme süresi eklendi. (mevcut işlem hızı limiti: 6 engel/dakika, 10 engeli kaldır/dakika)"
      },
      {
        type: "yeni özellik",
        description: "Uzun süren işlemler için işlem sırası eklendi. Devam eden bir işlem sırasında başlatılan yeni işlemler sıraya alınarak zamanı geldiğinde uygulanıyor."
      },
      {
        type: "yeni özellik",
        description: "Devam eden işlemin bekleme süresi ve işlem sırası ayrı bir durum sekmesinde gösterilmeye başlandı."
      },
      {
        type: "hata düzeltmesi",
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
        description: "Engelleme ve engel kaldırma işlemleri hızlandırıldı. Tüm işlemler arka planda gerçekleştirilmeye başlandı."
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
        description: "Engelleme ve engel kaldırma işlemleri hızlandırıldı."
      },
      {
        type: "yeni özellik",
        description: "Kullanıcının Ekşi Sözlük kullanıcı adı ile engellediği yazarların adları toplanmaya ve işlenmeye başlandı. Veri gönderimi ayarlar menüsünden kapatılabiliyor."
      },
      {
        type: "hata düzeltmesi",
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
        description: "Bir entry'yi favorileyen yazarları topluca engelleme özelliği eklendi."
      },
      {
        type: "yeni özellik",
        description: "Arayüz sadeleştirildi."
      },
      {
        type: "hata düzeltmesi",
        description: "Reklam engelleyici gibi sayfaya müdahale eden eklentilerin neden olduğu sorunlar giderildi."
      },
      {
        type: "hata düzeltmesi",
        description: "Engelleme devam ederken sayfa kapatıldığında eklentinin çökmesi önlendi."
      },
      {
        type: "hata düzeltmesi",
        description: "Kullanıcı adında boşluk bulunan yazarların engellenememesi sorunu çözüldü."
      }
    ]
  },
  {
    version: "1.1",
    releaseDate: "09.05.2022",
    changes: [
      {
        type: "hata düzeltmesi",
        description: "Chrome Web Mağazası sayfasındaki görseller güncellendi."
      }
    ]
  },
  {
    version: "1.0",
    releaseDate: "06.05.2022",
    changes: [
      {
        type: "yeni özellik",
        description: "Kullanıcının girdiği listedeki yazarları topluca engelleme özelliği eklendi."
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


