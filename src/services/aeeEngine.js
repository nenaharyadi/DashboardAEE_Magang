/**
 * Engine Perhitungan 9 Rumus AEE Universitas Padjadjaran
 * Mendukung Parameter & Bobot Dinamis dari Database (Admin Pusat)
 */

const DEFAULT_PARAM = {
  W1: 0.40,
  W2: 0.35,
  W3: 0.25,
  MS_STANDAR: 4.0,
  SEM_NORMAL_MAX: 8,
  SEM_MERAH_MIN: 9,
  SEM_MERAH_MAX: 14,
  TARGET_SKS: 144,
  IPK_MIN: 2.00,
  THRESHOLD_RI: 1.00,
  THRESHOLD_TA_KRITIS: 0.25,
  DAYS_PER_MONTH: 30.4375
};

const TA_STAGE_MAP = {
  'Pengajuan Judul': 1,
  'SUR': 2,
  'Bimbingan': 3,
  'Ujian Sidang': 4,
  'Lulus': 5
};

// Helper menggabungkan parameter dari database dengan nilai default
function buildParam(dbRow) {
  if (!dbRow) return { ...DEFAULT_PARAM };
  const semNormal = dbRow.s0_normal != null ? parseInt(dbRow.s0_normal, 10) : DEFAULT_PARAM.SEM_NORMAL_MAX;
  return {
    W1: dbRow.w1_ktw != null ? parseFloat(dbRow.w1_ktw) : DEFAULT_PARAM.W1,
    W2: dbRow.w2_masa_studi != null ? parseFloat(dbRow.w2_masa_studi) : DEFAULT_PARAM.W2,
    W3: dbRow.w3_progres_ta != null ? parseFloat(dbRow.w3_progres_ta) : DEFAULT_PARAM.W3,
    MS_STANDAR: semNormal / 2,
    SEM_NORMAL_MAX: semNormal,
    SEM_MERAH_MIN: dbRow.batas_kritis_min != null ? parseInt(dbRow.batas_kritis_min, 10) : DEFAULT_PARAM.SEM_MERAH_MIN,
    SEM_MERAH_MAX: dbRow.batas_kritis_max != null ? parseInt(dbRow.batas_kritis_max, 10) : DEFAULT_PARAM.SEM_MERAH_MAX,
    TARGET_SKS: dbRow.target_sks != null ? parseInt(dbRow.target_sks, 10) : DEFAULT_PARAM.TARGET_SKS,
    IPK_MIN: dbRow.ipk_minimal != null ? parseFloat(dbRow.ipk_minimal) : DEFAULT_PARAM.IPK_MIN,
    THRESHOLD_RI: dbRow.threshold_ri != null ? parseFloat(dbRow.threshold_ri) : DEFAULT_PARAM.THRESHOLD_RI,
    THRESHOLD_TA_KRITIS: dbRow.threshold_ta_kritis != null ? parseFloat(dbRow.threshold_ta_kritis) : DEFAULT_PARAM.THRESHOLD_TA_KRITIS,
    DAYS_PER_MONTH: DEFAULT_PARAM.DAYS_PER_MONTH
  };
}

// 1. Rumus F1: Indeks AEE (%)
function calcF1_AEE(cohortData, customParam) {
  const PARAM = buildParam(customParam);
  const N_cohort = cohortData.length;
  if (N_cohort === 0) return { skorAEE: 0, komponen: {} };

  const N_lulus_tepat = cohortData.filter(
    m => m.status_studi === 'Lulus' && parseInt(m.semester_lulus, 10) <= PARAM.SEM_NORMAL_MAX
  ).length;
  const komp1 = N_lulus_tepat / N_cohort;

  const lulusan = cohortData.filter(m => m.status_studi === 'Lulus' && m.semester_lulus);
  const totalMasaStudiTahun = lulusan.reduce((acc, m) => acc + (parseInt(m.semester_lulus, 10) / 2), 0);
  const MS_riil = lulusan.length > 0 ? totalMasaStudiTahun / lulusan.length : PARAM.MS_STANDAR;
  const komp2 = MS_riil > 0 ? PARAM.MS_STANDAR / MS_riil : 0;

  const mhsTA = cohortData.filter(m => m.status_ta && TA_STAGE_MAP[m.status_ta] >= 1);
  const N_mhs_TA = mhsTA.length;
  const sumProgresTA = mhsTA.reduce((acc, m) => acc + parseFloat(m.progres_ta || 0), 0);
  const komp3 = N_mhs_TA > 0 ? sumProgresTA / N_mhs_TA : 0;

  const skorAEE = ((komp1 * PARAM.W1) + (komp2 * PARAM.W2) + (komp3 * PARAM.W3)) * 100;

  return {
    skorAEE: Number(skorAEE.toFixed(2)),
    komponen: {
      ktwRatio: Number(komp1.toFixed(4)),
      efisiensiMasaStudi: Number(komp2.toFixed(4)),
      progresTARatio: Number(komp3.toFixed(4)),
      MS_riil_tahun: Number(MS_riil.toFixed(2))
    }
  };
}

// 2. Rumus F2: Deteksi Red-Flag Visual (Semester Kritis)
function calcF2_RedFlag(perwalianData, customParam) {
  const PARAM = buildParam(customParam);
  let countMerah = 0, countHijau = 0, countCuti = 0, countError = 0;

  const detail = perwalianData.map(mhs => {
    const sem = parseInt(mhs.semester_aktif, 10);
    let validasi = 'OK';
    let colorStatus = 'Hijau';

    if (isNaN(sem) || sem < 1 || sem > PARAM.SEM_MERAH_MAX) {
      validasi = 'Data semester aktif tidak valid dari API SIAT.';
      colorStatus = 'ERROR';
      countError++;
    } else if (mhs.status_studi === 'Cuti Resmi') {
      colorStatus = 'Cuti Resmi (Abu)';
      countCuti++;
    } else if (sem <= PARAM.SEM_NORMAL_MAX) {
      colorStatus = 'Hijau';
      countHijau++;
    } else if (sem >= PARAM.SEM_MERAH_MIN && sem <= PARAM.SEM_MERAH_MAX) {
      colorStatus = 'Merah';
      countMerah++;
    }

    return {
      npm: mhs.npm,
      nama: mhs.nama,
      semesterAktif: sem,
      validasi,
      colorStatus,
      isRedFlag: colorStatus === 'Merah'
    };
  });

  return {
    summary: {
      total: perwalianData.length,
      totalMerahKritis: countMerah,
      totalHijau: countHijau,
      totalCutiAbu: countCuti,
      totalError: countError
    },
    detail
  };
}

// 3. Rumus F3: Early Warning & Risk Index (R_i)
function calcF3_EarlyWarning(perwalianData, customParam) {
  const PARAM = buildParam(customParam);
  let countAktif = 0, countKuning = 0;

  const detail = perwalianData.map(mhs => {
    const sem = parseInt(mhs.semester_aktif, 10);
    const sks = parseInt(mhs.sks_kumulatif || 0, 10);
    const progresTA = parseFloat(mhs.progres_ta || 0);

    if (isNaN(sem)) {
      return { npm: mhs.npm, nama: mhs.nama, riskIndex: null, triggerStatus: 'Data tidak valid', badgeColor: '-' };
    }

    const riskIndex = (sem / PARAM.SEM_NORMAL_MAX) * (1 - (sks / PARAM.TARGET_SKS));
    const trigger1 = riskIndex >= PARAM.THRESHOLD_RI;
    const trigger2 = sem >= (PARAM.SEM_NORMAL_MAX - 1) && progresTA < PARAM.THRESHOLD_TA_KRITIS;
    const isAktif = trigger1 || trigger2;

    if (isAktif) countAktif++;

    let badgeColor = '-';
    if (mhs.status_studi === 'Cuti Resmi') badgeColor = 'Abu (Cuti)';
    else if (sem > PARAM.SEM_NORMAL_MAX) badgeColor = 'Merah';
    else if (isAktif) {
      badgeColor = 'Kuning';
      countKuning++;
    }

    return {
      npm: mhs.npm,
      nama: mhs.nama,
      semesterAktif: sem,
      sksKumulatif: sks,
      progresTA: progresTA,
      riskIndex: Number(riskIndex.toFixed(4)),
      triggerStatus: isAktif ? 'AKTIF' : 'Tidak aktif',
      badgeColor
    };
  });

  return {
    summary: {
      totalEvaluasi: perwalianData.length,
      totalPeringatanAktif: countAktif,
      totalBadgeKuning: countKuning
    },
    detail
  };
}

// 4. Rumus F4: Funnel Chart & Rata-rata Durasi TA
function calcF4_DurasiTA(cohortData) {
  const lulusanTA = cohortData.filter(m => m.tgl_pengajuan_judul && m.tgl_sidang_lulus);
  const totalHari = lulusanTA.reduce((acc, m) => {
    const diffTime = Math.abs(new Date(m.tgl_sidang_lulus) - new Date(m.tgl_pengajuan_judul));
    return acc + (diffTime / (1000 * 60 * 60 * 24));
  }, 0);

  const avgDurasiBulan = lulusanTA.length > 0 ? (totalHari / lulusanTA.length) / DEFAULT_PARAM.DAYS_PER_MONTH : 0;

  const funnelStages = [
    { stage: 'Pengajuan Judul', index: 1 },
    { stage: 'SUR', index: 2 },
    { stage: 'Bimbingan', index: 3 },
    { stage: 'Ujian Sidang', index: 4 },
    { stage: 'Lulus', index: 5 }
  ];

  const totalCohortTA = cohortData.filter(m => m.status_ta && TA_STAGE_MAP[m.status_ta] >= 1).length;

  const funnel = funnelStages.map(st => {
    const count = cohortData.filter(m => m.status_ta && TA_STAGE_MAP[m.status_ta] >= st.index).length;
    return {
      tahap: st.stage,
      indeks: st.index,
      jumlahMahasiswa: count,
      persentase: totalCohortTA > 0 ? Number(((count / totalCohortTA) * 100).toFixed(2)) : 0
    };
  });

  return {
    rataRataDurasiBulan: Number(avgDurasiBulan.toFixed(2)),
    totalMahasiswaSelesaiTA: lulusanTA.length,
    funnel
  };
}

// 5. Rumus F5: Proyeksi Kelulusan per Angkatan
function calcF5_Proyeksi(cohortData, customParam) {
  const PARAM = buildParam(customParam);
  const N_Cohort = cohortData.length;
  if (N_Cohort === 0) return { proyeksiKelulusanPersen: 0 };

  let countSudahLulus = 0;
  let countProyeksiMendatang = 0;

  cohortData.forEach(m => {
    const stageIdx = TA_STAGE_MAP[m.status_ta] || 0;
    const isEligible =
      parseInt(m.sks_kumulatif, 10) >= PARAM.TARGET_SKS &&
      stageIdx >= 4 &&
      parseFloat(m.ipk) >= PARAM.IPK_MIN;

    if (m.status_studi === 'Lulus') countSudahLulus++;
    else if (isEligible) countProyeksiMendatang++;
  });

  const totalProyeksi = countSudahLulus + countProyeksiMendatang;

  return {
    N_Cohort,
    totalProyeksiLulus: totalProyeksi,
    sudahLulus: countSudahLulus,
    proyeksiWisudaMendatang: countProyeksiMendatang,
    proyeksiKelulusanPersen: Number(((totalProyeksi / N_Cohort) * 100).toFixed(2))
  };
}

// 6. Rumus F6: Kelulusan Tepat Waktu (KTW)
function calcF6_KTW(cohortData, customParam) {
  const PARAM = buildParam(customParam);
  const N_total = cohortData.length;
  if (N_total === 0) return { ktwPersen: 0 };
  const countLulusTepat = cohortData.filter(
    m => m.status_studi === 'Lulus' && parseInt(m.semester_lulus, 10) <= PARAM.SEM_NORMAL_MAX
  ).length;
  return {
    totalCohort: N_total,
    lulusTepatWaktu: countLulusTepat,
    ktwPersen: Number(((countLulusTepat / N_total) * 100).toFixed(2))
  };
}

// 7. Rumus F7: Rata-rata Masa Studi Lulusan
function calcF7_MasaStudi(cohortData) {
  const lulusan = cohortData.filter(m => m.status_studi === 'Lulus' && m.semester_lulus);
  if (lulusan.length === 0) return { avgMasaStudiTahun: 0, totalLulusan: 0 };
  const totalTahun = lulusan.reduce((acc, m) => acc + (parseInt(m.semester_lulus, 10) / 2), 0);
  const avgIPK = lulusan.reduce((acc, m) => acc + parseFloat(m.ipk), 0) / lulusan.length;
  return {
    totalLulusan: lulusan.length,
    avgMasaStudiTahun: Number((totalTahun / lulusan.length).toFixed(2)),
    avgIPKLulusan: Number(avgIPK.toFixed(2))
  };
}

// 8. Rumus F8: Rasio Pengulangan Mata Kuliah
function calcF8_Pengulangan(khsLog, totalSKSDiambil) {
  const totalSKSDiulang = khsLog.reduce((acc, item) => acc + parseInt(item.sks, 10), 0);
  const rasio = totalSKSDiambil > 0 ? (totalSKSDiulang / totalSKSDiambil) * 100 : 0;
  return {
    totalSKSDiulang,
    totalSKSDiambil,
    rasioPengulanganPersen: Number(rasio.toFixed(2)),
    pengulanganMKPrasyarat: khsLog.filter(item => item.is_prasyarat === 1).length
  };
}

// 9. Rumus F9: Trigger Automated WA Alert
function calcF9_NotifikasiWA(perwalianData, dosenWaliName = 'Dr. Contoh Pengampu, M.Si.', customParam) {
  const PARAM = buildParam(customParam);
  const detail = perwalianData.map(mhs => {
    const sem = parseInt(mhs.semester_aktif, 10);
    if (isNaN(sem)) return { npm: mhs.npm, statusNotif: 'Tidak kirim (data tidak valid)' };

    const isSemMerah = sem > PARAM.SEM_NORMAL_MAX;
    const isFormKosong = !mhs.kategori_pemicu;
    const isCuti = mhs.status_studi === 'Cuti Resmi';

    let statusNotif = 'Tidak kirim';
    let pesan = null;

    if (isSemMerah && isFormKosong) {
      if (isCuti) statusNotif = 'Dikecualikan (ALT-01)';
      else {
        statusNotif = 'Send WA Alert';
        pesan = `[Peringatan AEE Unpad] Yth. Dosen Wali ${dosenWaliName}, mhs perwalian Anda ${mhs.nama} / ${mhs.npm} telah memasuki Semester ${sem}. Mohon isi Form Klarifikasi Keterlambatan pada Dashboard AEE.`;
      }
    }

    return { npm: mhs.npm, nama: mhs.nama, semesterAktif: sem, statusNotif, pesan };
  });

  return {
    summary: {
      totalEvaluasi: perwalianData.length,
      totalAlertTerkirim: detail.filter(d => d.statusNotif === 'Send WA Alert').length
    },
    detail
  };
}

module.exports = {
  DEFAULT_PARAM,
  buildParam,
  calcF1_AEE,
  calcF2_RedFlag,
  calcF3_EarlyWarning,
  calcF4_DurasiTA,
  calcF5_Proyeksi,
  calcF6_KTW,
  calcF7_MasaStudi,
  calcF8_Pengulangan,
  calcF9_NotifikasiWA
};