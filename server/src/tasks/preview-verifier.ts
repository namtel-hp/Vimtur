import { Database, RouterTask, TaskRunnerCallback } from '../types';
import { ImportUtils } from '../cache/import-utils';
import { execute } from 'proper-job';
import Config from '../config';

const PREVIEW_BATCH_SIZE = 8;

export class PreviewVerifier {
  public static getTask(database: Database): RouterTask {
    return {
      description: 'Verify previews exist',
      runner: (updateStatus: TaskRunnerCallback) => {
        return execute(
          async () => {
            const withPreviews = await database.subset({
              type: { equalsAny: ['video'] },
              preview: true,
            });
            updateStatus(0, withPreviews.length);

            return {
              iterable: withPreviews,
              init: {
                current: 0,
                max: withPreviews.length,
              },
            };
          },
          async (hash, init) => {
            if (!init) {
              throw new Error('init not defined');
            }

            const media = await database.getMedia(hash);
            if (!media) {
              throw new Error(`Failed to find media for hash: ${hash}`);
            }
            const path = `${Config.get().cachePath}/previews/${media.hash}.png`;
            const exists = await ImportUtils.exists(path);
            if (!exists) {
              console.warn(`${media.absolutePath} missing preview`);
              await database.saveMedia(media.hash, { preview: false });
            }

            updateStatus(init.current++, init.max);
          },
          { parallel: PREVIEW_BATCH_SIZE },
        );
      },
    };
  }
}
