const { execSync } = require('child_process');

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  const requireDistributionSigning = process.env.TJUAEUI_REQUIRE_DISTRIBUTION_SIGNING === '1';

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // @electron/notarize 仅提供 ESM，因此延迟加载。
  const { notarize } = await import('@electron/notarize');

  const appName = context.packager.appInfo.productFilename;
  const appBundleId = context.packager.appInfo.id;
  const appPath = `${appOutDir}/${appName}.app`;

  // 公证前先确认应用确实已签名。
  try {
    execSync(`codesign --verify --verbose "${appPath}"`, { stdio: 'pipe' });
    console.log(`应用 ${appName} 已正确完成代码签名`);
  } catch (error) {
    if (requireDistributionSigning) {
      throw new Error(`正式分发要求有效的 Developer ID 签名：${error.message}`);
    }
    console.log(`应用 ${appName} 尚未签名，正在应用临时签名……`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
      console.log(`已成功为 ${appName} 应用临时签名`);
    } catch (adHocError) {
      console.error('临时签名失败：', adHocError.message);
    }
    return;
  }

  // 未提供凭据时跳过公证。
  if (!process.env.appleId || !process.env.appleIdPassword || !process.env.teamId) {
    if (requireDistributionSigning) {
      throw new Error('正式分发要求完整的 Apple 公证凭据（Apple ID、专用密码和 Team ID）');
    }
    console.log('缺少 Apple ID 凭据，已跳过公证');
    return;
  }

  console.log(`正在公证 ${appName}（${appBundleId}）……`);

  try {
    await notarize({
      tool: 'notarytool',
      appBundleId,
      appPath: appPath,
      appleId: process.env.appleId,
      appleIdPassword: process.env.appleIdPassword,
      teamId: process.env.teamId,
    });
    console.log('公证已成功完成');
  } catch (error) {
    console.error('公证失败：', error);
    throw error;
  }
};
